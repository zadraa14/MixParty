import gc
import json
import os
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

app = FastAPI(title="MixParty Karaoke Sync Worker", version="1.4")

MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
CPU_THREADS = max(1, int(os.getenv("WHISPER_THREADS", "1")))
NUM_WORKERS = max(1, int(os.getenv("WHISPER_NUM_WORKERS", "1")))
MIN_CONFIDENCE = float(os.getenv("KARAOKE_MIN_CONFIDENCE", "92"))
MAX_AUDIO_MB = int(os.getenv("KARAOKE_MAX_AUDIO_MB", "40"))
MAX_AUDIO_MINUTES = float(os.getenv("KARAOKE_MAX_AUDIO_MINUTES", "8"))
TOKEN = os.getenv("KARAOKE_SYNC_ENGINE_TOKEN", "").strip()

_model = None


class AlignedLine(BaseModel):
    time: float
    text: str


class AlignResponse(BaseModel):
    ok: bool = True
    engine: str = "faster-whisper-v1.4"
    publishable: bool
    confidence: float
    lines: list[AlignedLine]
    diagnostics: dict[str, Any] = Field(default_factory=dict)


def require_token(authorization: Optional[str]) -> None:
    if not TOKEN:
        return
    expected = f"Bearer {TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel(
            MODEL_NAME,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
            cpu_threads=CPU_THREADS,
            num_workers=NUM_WORKERS,
        )
    return _model


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower())
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r"[^a-z0-9']+", " ", value)
    return " ".join(value.split())


def normalize_audio(source: Path, target: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000",
         "-c:a", "pcm_s16le", str(target)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def probe_duration(path: Path) -> float:
    try:
        p = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            check=True, capture_output=True, text=True
        )
        return float((p.stdout or "0").strip() or 0)
    except Exception:
        return 0.0


def align_lyrics(words: list[dict[str, Any]], transcript: str):
    import difflib

    lyric_lines = [x.strip() for x in transcript.splitlines() if x.strip()]
    word_norm = [normalize_text(w["word"]) for w in words]

    output: list[AlignedLine] = []
    scores: list[float] = []
    cursor = 0

    for lyric in lyric_lines:
        expected_tokens = normalize_text(lyric).split()
        if not expected_tokens:
            continue

        expected = " ".join(expected_tokens)
        # Search locally and monotonically: a lyric line can never jump backwards.
        search_end = min(len(words), cursor + max(45, len(expected_tokens) * 7))
        min_len = max(1, len(expected_tokens) - 3)
        max_len = len(expected_tokens) + 4

        best = None
        for start in range(cursor, search_end):
            for length in range(min_len, max_len + 1):
                end = start + length
                if end > len(words):
                    break
                candidate = " ".join(word_norm[start:end])
                score = difflib.SequenceMatcher(None, expected, candidate).ratio()

                # Prefer close matches near the expected cursor.
                distance_penalty = min(0.08, max(0, start - cursor) * 0.0015)
                adjusted = score - distance_penalty

                if best is None or adjusted > best[0]:
                    best = (adjusted, score, start, end)

        if not best or best[1] < 0.50:
            continue

        _, raw_score, start, end = best
        output.append(AlignedLine(time=round(float(words[start]["start"]), 3), text=lyric))
        scores.append(raw_score)
        cursor = max(cursor, end)

    coverage = len(output) / max(1, len(lyric_lines))
    similarity = sum(scores) / max(1, len(scores))

    # Strict certification: coverage matters more than fuzzy text similarity.
    confidence = max(0.0, min(100.0, (coverage * 0.75 + similarity * 0.25) * 100.0))

    # Basic timestamp sanity checks.
    monotonic = all(output[i].time < output[i + 1].time for i in range(len(output) - 1))
    if not monotonic:
        confidence = min(confidence, 70.0)

    return output, confidence, {
        "lyricLineCount": len(lyric_lines),
        "alignedLineCount": len(output),
        "coverage": round(coverage, 4),
        "averageSimilarity": round(similarity, 4),
        "monotonic": monotonic,
    }


def process_audio(audio_path: Path, transcript: str) -> AlignResponse:
    normalized = audio_path.with_suffix(".16k.wav")
    normalize_audio(audio_path, normalized)

    duration = probe_duration(normalized)
    if duration and duration > MAX_AUDIO_MINUTES * 60:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too long: {duration:.0f}s; limit={MAX_AUDIO_MINUTES:.0f} min"
        )

    model = get_model()

    segments, info = model.transcribe(
        str(normalized),
        language=None,
        beam_size=1,
        best_of=1,
        temperature=0,
        vad_filter=False,
        word_timestamps=True,
        condition_on_previous_text=False,
    )

    words: list[dict[str, Any]] = []
    segment_count = 0

    for segment in segments:
        segment_count += 1
        for word in segment.words or []:
            if word.start is None or not (word.word or "").strip():
                continue
            words.append({
                "word": word.word.strip(),
                "start": float(word.start),
                "end": float(word.end or word.start),
                "probability": float(word.probability or 0),
            })

    lines, confidence, diag = align_lyrics(words, transcript)
    publishable = (
        confidence >= MIN_CONFIDENCE
        and diag["coverage"] >= 0.90
        and diag["monotonic"]
        and len(lines) >= 2
    )

    probabilities = [w["probability"] for w in words if w["probability"] > 0]
    avg_word_probability = (
        sum(probabilities) / len(probabilities) if probabilities else 0.0
    )

    diagnostics = {
        **diag,
        "model": MODEL_NAME,
        "device": DEVICE,
        "computeType": COMPUTE_TYPE,
        "cpuThreads": CPU_THREADS,
        "numWorkers": NUM_WORKERS,
        "durationSeconds": round(duration, 2),
        "language": getattr(info, "language", None),
        "languageProbability": round(float(getattr(info, "language_probability", 0) or 0), 4),
        "segmentCount": segment_count,
        "wordCount": len(words),
        "averageWordProbability": round(avg_word_probability, 4),
        "minimumConfidence": MIN_CONFIDENCE,
        "lowMemory": True,
        "pyannote": False,
        "whisperx": False,
    }

    del words, segments
    gc.collect()

    return AlignResponse(
        publishable=publishable,
        confidence=round(confidence, 2),
        lines=lines,
        diagnostics=diagnostics,
    )


@app.get("/")
def root():
    return {
        "ok": True,
        "service": "mixparty-karaoke-sync-worker",
        "engine": "faster-whisper",
        "version": "1.4",
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "mixparty-karaoke-sync-worker",
        "engine": "faster-whisper",
        "model": MODEL_NAME,
        "device": DEVICE,
        "computeType": COMPUTE_TYPE,
        "minimumConfidence": MIN_CONFIDENCE,
        "pyannote": False,
        "whisperx": False,
    }


@app.post("/align-upload", response_model=AlignResponse)
async def align_upload(
    audio: UploadFile = File(...),
    payload: Optional[str] = Form(default=None),
    transcript: Optional[str] = Form(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """
    Compatible avec l'API MixParty actuelle.

    Formats acceptés :
    1) payload=<JSON> + audio=<fichier>
       -> payload.lyrics.plainLyrics ou payload.lyrics.syncedLyrics
    2) transcript=<texte> + audio=<fichier>
       -> mode direct / debug
    """
    require_token(authorization)

    resolved_transcript = (transcript or "").strip()
    payload_data: dict[str, Any] = {}

    if payload:
        try:
            payload_data = json.loads(payload)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Payload JSON invalide: {exc}",
            )

        lyrics = payload_data.get("lyrics") or {}
        plain = str(lyrics.get("plainLyrics") or "").strip()
        synced = str(lyrics.get("syncedLyrics") or "").strip()

        if plain:
            resolved_transcript = plain
        elif synced:
            # Retire les timestamps LRC afin que faster-whisper compare
            # uniquement les paroles, puis recalcule ses propres timings.
            cleaned_lines = []
            for raw_line in synced.splitlines():
                cleaned = re.sub(r"^\s*\[[0-9]{1,3}:[0-9]{2}(?:\.[0-9]{1,3})?\]\s*", "", raw_line)
                cleaned = cleaned.strip()
                if cleaned:
                    cleaned_lines.append(cleaned)
            resolved_transcript = "\n".join(cleaned_lines)

    if not resolved_transcript:
        raise HTTPException(
            status_code=400,
            detail="Aucune parole exploitable reçue (payload.lyrics ou transcript).",
        )

    suffix = Path(audio.filename or "audio.mp3").suffix or ".mp3"
    with tempfile.TemporaryDirectory(prefix="mixparty-karaoke-") as td:
        source = Path(td) / f"source{suffix}"
        total = 0

        with source.open("wb") as f:
            while True:
                chunk = await audio.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_AUDIO_MB * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="Audio file too large")
                f.write(chunk)

        result = process_audio(source, resolved_transcript)

        # Ajoute quelques infos utiles de MixParty dans les diagnostics
        # sans modifier le contrat de sortie.
        if payload_data:
            result.diagnostics["videoId"] = payload_data.get("videoId")
            result.diagnostics["title"] = payload_data.get("title")
            result.diagnostics["artistName"] = payload_data.get("artistName")
            lyrics = payload_data.get("lyrics") or {}
            result.diagnostics["lrclibId"] = lyrics.get("lrclibId")

        return result


@app.post("/align", response_model=AlignResponse)
async def align_compat(
    audio: UploadFile = File(...),
    payload: Optional[str] = Form(default=None),
    transcript: Optional[str] = Form(default=None),
    authorization: Optional[str] = Header(default=None),
):
    return await align_upload(
        audio=audio,
        payload=payload,
        transcript=transcript,
        authorization=authorization,
    )

