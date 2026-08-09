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
    engine: str = "faster-whisper-v1.5"
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
    """
    V1.5 Timing Confidence

    Objectif :
    juger avant tout si les débuts de lignes Karaoké sont temporellement fiables.

    Le score final privilégie :
    - couverture des lignes
    - ordre strictement croissant
    - continuité temporelle
    - qualité des ancres lexicales (mots distinctifs)
    - similarité textuelle globale, mais avec un poids plus faible

    Un texte mal reconnu mot-à-mot ne doit plus faire chuter exagérément
    un alignement temporel pourtant cohérent.
    """
    import difflib

    lyric_lines = [x.strip() for x in transcript.splitlines() if x.strip()]
    word_norm = [normalize_text(w["word"]) for w in words]

    output: list[AlignedLine] = []
    text_scores: list[float] = []
    anchor_scores: list[float] = []
    start_indices: list[int] = []
    cursor = 0

    def useful_tokens(line: str) -> list[str]:
        tokens = [t for t in normalize_text(line).split() if t]

        # On privilégie les mots plus discriminants.
        # Les très petits mots ("je", "de", "la"...), très fréquents,
        # pèsent peu dans la qualité d'une ancre temporelle.
        strong = [t for t in tokens if len(t) >= 4]
        return strong if strong else tokens

    for lyric in lyric_lines:
        expected_tokens = normalize_text(lyric).split()
        if not expected_tokens:
            continue

        expected = " ".join(expected_tokens)
        strong_tokens = useful_tokens(lyric)

        # Recherche strictement monotone, localisée autour du curseur.
        search_end = min(len(words), cursor + max(56, len(expected_tokens) * 8))
        min_len = max(1, len(expected_tokens) - 4)
        max_len = len(expected_tokens) + 5

        best = None

        for word_start in range(cursor, search_end):
            for length in range(min_len, max_len + 1):
                word_end = word_start + length
                if word_end > len(words):
                    break

                candidate_tokens = word_norm[word_start:word_end]
                candidate = " ".join(candidate_tokens)

                text_score = difflib.SequenceMatcher(
                    None,
                    expected,
                    candidate,
                ).ratio()

                # Anchor score : présence des mots distinctifs de la ligne
                # dans la fenêtre reconnue.
                candidate_set = set(candidate_tokens)
                if strong_tokens:
                    matched = sum(1 for t in strong_tokens if t in candidate_set)
                    anchor_score = matched / len(strong_tokens)
                else:
                    anchor_score = 0.0

                # Préférence pour une fenêtre proche de la position attendue.
                distance_penalty = min(
                    0.10,
                    max(0, word_start - cursor) * 0.0015,
                )

                # Le choix de la fenêtre combine texte + ancres lexicales.
                adjusted = (
                    text_score * 0.62
                    + anchor_score * 0.38
                    - distance_penalty
                )

                if best is None or adjusted > best[0]:
                    best = (
                        adjusted,
                        text_score,
                        anchor_score,
                        word_start,
                        word_end,
                    )

        # En V1.5 on accepte une fenêtre un peu moins parfaite textuellement,
        # à condition qu'elle possède au moins une ancre exploitable.
        if not best:
            continue

        _, text_score, anchor_score, word_start, word_end = best

        if text_score < 0.40 and anchor_score < 0.34:
            continue

        output.append(
            AlignedLine(
                time=round(float(words[word_start]["start"]), 3),
                text=lyric,
            )
        )
        text_scores.append(text_score)
        anchor_scores.append(anchor_score)
        start_indices.append(word_start)
        cursor = max(cursor, word_end)

    coverage = len(output) / max(1, len(lyric_lines))
    similarity = sum(text_scores) / max(1, len(text_scores))
    anchor_quality = sum(anchor_scores) / max(1, len(anchor_scores))

    monotonic = all(
        output[i].time < output[i + 1].time
        for i in range(len(output) - 1)
    )

    # --------------------------------------------------------
    # Timing continuity
    # --------------------------------------------------------
    # On regarde si les lignes avancent régulièrement dans la chanson.
    # On ne cherche PAS une cadence fixe : on pénalise seulement
    # les sauts aberrants ou les lignes presque superposées.
    continuity_scores: list[float] = []

    for i in range(len(output) - 1):
        delta = output[i + 1].time - output[i].time

        if delta <= 0:
            continuity_scores.append(0.0)
        elif delta < 0.35:
            continuity_scores.append(0.30)
        elif delta <= 20.0:
            continuity_scores.append(1.0)
        elif delta <= 35.0:
            continuity_scores.append(0.70)
        else:
            continuity_scores.append(0.35)

    continuity = (
        sum(continuity_scores) / len(continuity_scores)
        if continuity_scores
        else 1.0
    )

    # --------------------------------------------------------
    # Cursor progression
    # --------------------------------------------------------
    # Les lignes doivent avancer dans les mots reconnus sans énormes retours
    # ni réutilisation de la même zone.
    progression_scores: list[float] = []
    for i in range(len(start_indices) - 1):
        jump = start_indices[i + 1] - start_indices[i]
        if jump <= 0:
            progression_scores.append(0.0)
        elif jump <= 40:
            progression_scores.append(1.0)
        elif jump <= 80:
            progression_scores.append(0.75)
        else:
            progression_scores.append(0.45)

    progression = (
        sum(progression_scores) / len(progression_scores)
        if progression_scores
        else 1.0
    )

    # --------------------------------------------------------
    # Final Timing Confidence
    # --------------------------------------------------------
    # Poids volontairement orientés Karaoké :
    # 42% couverture
    # 20% continuité temporelle
    # 14% progression monotone
    # 14% ancres lexicales
    # 10% similarité textuelle brute
    timing_confidence = (
        coverage * 0.42
        + continuity * 0.20
        + progression * 0.14
        + anchor_quality * 0.14
        + similarity * 0.10
    )

    if not monotonic:
        timing_confidence = min(timing_confidence, 0.70)

    confidence = max(0.0, min(100.0, timing_confidence * 100.0))

    diagnostics = {
        "lyricLineCount": len(lyric_lines),
        "alignedLineCount": len(output),
        "coverage": round(coverage, 4),
        "averageSimilarity": round(similarity, 4),
        "anchorQuality": round(anchor_quality, 4),
        "timingContinuity": round(continuity, 4),
        "cursorProgression": round(progression, 4),
        "monotonic": monotonic,
        "timingConfidenceVersion": "v1.5",
        "scoreWeights": {
            "coverage": 0.42,
            "timingContinuity": 0.20,
            "cursorProgression": 0.14,
            "anchorQuality": 0.14,
            "textSimilarity": 0.10,
        },
    }

    return output, confidence, diagnostics


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
        and diag["timingContinuity"] >= 0.90
        and diag["cursorProgression"] >= 0.85
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
        "version": "1.5",
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

