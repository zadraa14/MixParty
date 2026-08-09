from __future__ import annotations

import os
import gc
import tempfile
import subprocess
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

app = FastAPI(title="MixParty Karaoke Sync Worker", version="1.0.0")

WORKER_TOKEN = os.getenv("KARAOKE_SYNC_ENGINE_TOKEN", "").strip()
MIN_CONFIDENCE = float(os.getenv("KARAOKE_MIN_CONFIDENCE", "92"))
MAX_AUDIO_MB = int(os.getenv("KARAOKE_MAX_AUDIO_MB", "40"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_BATCH_SIZE = max(1, int(os.getenv("WHISPER_BATCH_SIZE", "1")))
WHISPER_THREADS = max(1, int(os.getenv("WHISPER_THREADS", "1")))
KARAOKE_MAX_AUDIO_MINUTES = float(os.getenv("KARAOKE_MAX_AUDIO_MINUTES", "8"))


class LyricInput(BaseModel):
    lrclibId: Optional[int] = None
    trackName: Optional[str] = None
    artistName: Optional[str] = None
    duration: Optional[float] = None
    syncedLyrics: str = ""
    plainLyrics: str = ""


class YoutubeInput(BaseModel):
    videoId: str
    channelTitle: Optional[str] = None
    metadataSource: Optional[str] = None


class AlignRequest(BaseModel):
    version: int = 1
    videoId: str
    title: str
    rawTitle: Optional[str] = None
    artistName: str
    durationSeconds: Optional[float] = None
    youtube: YoutubeInput
    lyrics: LyricInput
    # IMPORTANT: this must be an audio URL that MixParty is authorized to process.
    # The worker intentionally does not scrape/extract YouTube audio itself.
    audioUrl: Optional[str] = None


class AlignedLine(BaseModel):
    time: float
    text: str


class AlignResponse(BaseModel):
    status: str
    confidence: float = Field(ge=0, le=100)
    offsetSeconds: float = 0
    lines: list[AlignedLine] = []
    engine: str = "whisperx"
    reason: str = ""
    diagnostics: dict[str, Any] = {}


def require_token(authorization: Optional[str]) -> None:
    if not WORKER_TOKEN:
        return
    if authorization != f"Bearer {WORKER_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def plain_lyrics(req: AlignRequest) -> str:
    if req.lyrics.plainLyrics.strip():
        return req.lyrics.plainLyrics.strip()
    # Fallback: strip LRC timestamps to get text for forced alignment.
    import re
    lines = []
    for raw in req.lyrics.syncedLyrics.splitlines():
        line = re.sub(r"^\s*\[[0-9]{1,3}:[0-9]{1,2}(?:\.[0-9]{1,3})?\]\s*", "", raw).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


async def download_authorized_audio(url: str, destination: Path) -> None:
    timeout = httpx.Timeout(60.0, connect=15.0)
    total = 0
    max_bytes = MAX_AUDIO_MB * 1024 * 1024
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "audio" not in content_type and "octet-stream" not in content_type:
                raise HTTPException(status_code=400, detail=f"audioUrl is not audio ({content_type})")
            with destination.open("wb") as out:
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        raise HTTPException(status_code=413, detail="Audio file too large")
                    out.write(chunk)


def normalize_audio_for_whisper(source_path: Path, target_path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(target_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def probe_audio_duration(path: Path) -> float:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return float((result.stdout or "0").strip() or 0)
    except Exception:
        return 0.0


def align_with_whisperx(audio_path: Path, transcript: str) -> tuple[list[AlignedLine], float, dict[str, Any]]:
    """
    Low-memory Railway worker:
    - audio mono 16 kHz
    - Whisper base / CPU / int8
    - batch_size=1
    - 1 thread
    - explicit cleanup after each job
    """
    try:
        import whisperx
    except Exception as exc:
        raise RuntimeError("whisperx is not installed") from exc

    import difflib
    import re

    normalized_path = audio_path.with_suffix(".16k.wav")
    normalize_audio_for_whisper(audio_path, normalized_path)

    duration_seconds = probe_audio_duration(normalized_path)
    if duration_seconds > KARAOKE_MAX_AUDIO_MINUTES * 60:
        raise RuntimeError(
            f"Audio trop long ({duration_seconds:.0f}s). "
            f"Limite Low-Memory: {KARAOKE_MAX_AUDIO_MINUTES:.0f} min."
        )

    model = None
    model_a = None
    audio = None
    result = None
    aligned = None

    try:
        model = whisperx.load_model(
            WHISPER_MODEL,
            WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
            threads=WHISPER_THREADS,
        )

        audio = whisperx.load_audio(str(normalized_path))
        result = model.transcribe(audio, batch_size=WHISPER_BATCH_SIZE)

        language = result.get("language") or "fr"
        model_a, metadata = whisperx.load_align_model(
            language_code=language,
            device=WHISPER_DEVICE,
        )
        aligned = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            audio,
            WHISPER_DEVICE,
            return_char_alignments=False,
        )

        words: list[dict[str, Any]] = []
        for segment in aligned.get("segments", []):
            for word in segment.get("words", []) or []:
                if word.get("start") is None or not str(word.get("word", "")).strip():
                    continue
                words.append({
                    "word": str(word["word"]).strip(),
                    "start": float(word["start"]),
                })

        lyric_lines = [line.strip() for line in transcript.splitlines() if line.strip()]
        if not lyric_lines or not words:
            return [], 0.0, {
                "language": language,
                "wordCount": len(words),
                "lyricLineCount": len(lyric_lines),
                "model": WHISPER_MODEL,
                "device": WHISPER_DEVICE,
                "computeType": WHISPER_COMPUTE_TYPE,
                "batchSize": WHISPER_BATCH_SIZE,
                "threads": WHISPER_THREADS,
                "durationSeconds": round(duration_seconds, 2),
                "lowMemory": True,
            }

        def norm(value: str) -> str:
            value = value.lower()
            value = re.sub(r"[^\wÀ-ÿ']+", " ", value, flags=re.UNICODE)
            return " ".join(value.split())

        word_text = [norm(w["word"]) for w in words]
        cursor = 0
        output: list[AlignedLine] = []
        match_scores: list[float] = []

        for lyric in lyric_lines:
            tokens = norm(lyric).split()
            if not tokens:
                continue

            expected = " ".join(tokens)
            best: tuple[float, int, int] | None = None

            # Fenêtre volontairement plus courte pour réduire CPU + RAM.
            max_window = min(len(words), cursor + max(28, len(tokens) * 5))
            min_len = max(1, len(tokens) - 2)
            max_len = len(tokens) + 3

            for word_start in range(cursor, max_window):
                for length in range(min_len, max_len + 1):
                    word_end = word_start + length
                    if word_end > len(words):
                        break
                    candidate = " ".join(word_text[word_start:word_end])
                    score = difflib.SequenceMatcher(None, expected, candidate).ratio()
                    if best is None or score > best[0]:
                        best = (score, word_start, word_end)

            if not best or best[0] < 0.42:
                continue

            score, word_start, word_end = best
            output.append(
                AlignedLine(
                    time=round(words[word_start]["start"], 3),
                    text=lyric,
                )
            )
            match_scores.append(score)
            cursor = max(cursor, word_end)

        confidence = 0.0
        if lyric_lines:
            coverage = len(output) / len(lyric_lines)
            similarity = sum(match_scores) / max(1, len(match_scores))
            confidence = max(
                0.0,
                min(100.0, (coverage * 0.65 + similarity * 0.35) * 100.0),
            )

        diagnostics = {
            "language": language,
            "wordCount": len(words),
            "lyricLineCount": len(lyric_lines),
            "alignedLineCount": len(output),
            "coverage": round(len(output) / max(1, len(lyric_lines)), 4),
            "averageSimilarity": round(
                sum(match_scores) / max(1, len(match_scores)),
                4,
            ),
            "model": WHISPER_MODEL,
            "device": WHISPER_DEVICE,
            "computeType": WHISPER_COMPUTE_TYPE,
            "batchSize": WHISPER_BATCH_SIZE,
            "threads": WHISPER_THREADS,
            "durationSeconds": round(duration_seconds, 2),
            "lowMemory": True,
        }

        return output, confidence, diagnostics

    finally:
        # Explicit cleanup after every song.
        aligned = None
        result = None
        audio = None
        model_a = None
        model = None
        gc.collect()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "mixparty-karaoke-sync-worker",
        "engine": "whisperx",
        "model": WHISPER_MODEL,
        "device": WHISPER_DEVICE,
        "minimumConfidence": MIN_CONFIDENCE,
    }



async def run_alignment_with_local_audio(req: AlignRequest, audio_path: Path) -> AlignResponse:
    transcript = plain_lyrics(req)
    if not transcript:
        return AlignResponse(
            status="failed",
            confidence=0,
            engine="whisperx-v1.3-low-memory",
            reason="Aucun texte de paroles exploitable.",
        )

    try:
        lines, confidence, diagnostics = align_with_whisperx(audio_path, transcript)
    except Exception as exc:
        return AlignResponse(
            status="failed",
            confidence=0,
            engine="whisperx-v1.3-low-memory",
            reason=f"Erreur alignement: {exc}",
        )

    if len(lines) < 5:
        return AlignResponse(
            status="failed",
            confidence=confidence,
            lines=lines,
            engine="whisperx-v1.3-low-memory",
            reason="Pas assez de lignes réalignées.",
            diagnostics=diagnostics,
        )

    status = "certified" if confidence >= MIN_CONFIDENCE else "needs_review"
    return AlignResponse(
        status=status,
        confidence=round(confidence, 2),
        offsetSeconds=0,
        lines=lines,
        engine="whisperx-v1.3-low-memory",
        reason=(
            "Alignement audio certifié."
            if status == "certified"
            else "Alignement calculé mais confiance insuffisante pour certification automatique."
        ),
        diagnostics=diagnostics,
    )


@app.post("/align-upload", response_model=AlignResponse)
async def align_upload(
    payload: str = Form(...),
    audio: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
) -> AlignResponse:
    require_token(authorization)

    try:
        req = AlignRequest.model_validate_json(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Payload invalide: {exc}")

    max_bytes = MAX_AUDIO_MB * 1024 * 1024
    total = 0
    suffix = Path(audio.filename or "source.audio").suffix or ".audio"

    with tempfile.TemporaryDirectory(prefix="mixparty-karaoke-upload-") as tmp:
        audio_path = Path(tmp) / f"source{suffix}"

        with audio_path.open("wb") as out:
            while True:
                chunk = await audio.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(status_code=413, detail="Audio file too large")
                out.write(chunk)

        if total <= 0:
            raise HTTPException(status_code=400, detail="Fichier audio vide")

        return await run_alignment_with_local_audio(req, audio_path)


@app.post("/align", response_model=AlignResponse)
async def align(req: AlignRequest, authorization: Optional[str] = Header(default=None)) -> AlignResponse:
    require_token(authorization)

    if not req.audioUrl:
        return AlignResponse(
            status="needs_review",
            confidence=0,
            engine="whisperx-v1.3-low-memory",
            reason="audioUrl manquant : le worker doit analyser exactement l'audio utilisé par MixParty.",
            diagnostics={"videoId": req.videoId, "missing": "audioUrl"},
        )

    with tempfile.TemporaryDirectory(prefix="mixparty-karaoke-") as tmp:
        audio_path = Path(tmp) / "source.audio"
        await download_authorized_audio(req.audioUrl, audio_path)
        return await run_alignment_with_local_audio(req, audio_path)
