from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="MixParty Karaoke Sync Worker", version="1.0.0")

WORKER_TOKEN = os.getenv("KARAOKE_SYNC_ENGINE_TOKEN", "").strip()
MIN_CONFIDENCE = float(os.getenv("KARAOKE_MIN_CONFIDENCE", "92"))
MAX_AUDIO_MB = int(os.getenv("KARAOKE_MAX_AUDIO_MB", "40"))
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "medium")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")


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


def align_with_whisperx(audio_path: Path, transcript: str) -> tuple[list[AlignedLine], float, dict[str, Any]]:
    """
    V1 worker: use WhisperX transcription + alignment, then map the supplied lyric
    lines to the aligned transcription by ordered fuzzy matching.

    This keeps MixParty's LRCLIB text, while timings come from the actual audio.
    """
    try:
        import whisperx
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("whisperx is not installed") from exc

    import difflib
    import re

    device = WHISPER_DEVICE
    model = whisperx.load_model(WHISPER_MODEL, device, compute_type=WHISPER_COMPUTE_TYPE)
    audio = whisperx.load_audio(str(audio_path))
    result = model.transcribe(audio, batch_size=8)

    language = result.get("language") or "fr"
    model_a, metadata = whisperx.load_align_model(language_code=language, device=device)
    aligned = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)

    words: list[dict[str, Any]] = []
    for segment in aligned.get("segments", []):
        for word in segment.get("words", []) or []:
            if word.get("start") is None or not str(word.get("word", "")).strip():
                continue
            words.append({"word": str(word["word"]).strip(), "start": float(word["start"])})

    lyric_lines = [line.strip() for line in transcript.splitlines() if line.strip()]
    if not lyric_lines or not words:
        return [], 0.0, {"language": language, "wordCount": len(words), "lyricLineCount": len(lyric_lines)}

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
        max_window = min(len(words), cursor + max(40, len(tokens) * 6))
        min_len = max(1, len(tokens) - 2)
        max_len = len(tokens) + 4

        for start in range(cursor, max_window):
            for length in range(min_len, max_len + 1):
                end = start + length
                if end > len(words):
                    break
                candidate = " ".join(word_text[start:end])
                score = difflib.SequenceMatcher(None, expected, candidate).ratio()
                if best is None or score > best[0]:
                    best = (score, start, end)

        if not best or best[0] < 0.42:
            continue

        score, start, end = best
        output.append(AlignedLine(time=round(words[start]["start"], 3), text=lyric))
        match_scores.append(score)
        cursor = max(cursor, end)

    confidence = 0.0
    if lyric_lines:
        coverage = len(output) / len(lyric_lines)
        similarity = sum(match_scores) / max(1, len(match_scores))
        confidence = max(0.0, min(100.0, (coverage * 0.65 + similarity * 0.35) * 100.0))

    diagnostics = {
        "language": language,
        "wordCount": len(words),
        "lyricLineCount": len(lyric_lines),
        "alignedLineCount": len(output),
        "coverage": round(len(output) / max(1, len(lyric_lines)), 4),
        "averageSimilarity": round(sum(match_scores) / max(1, len(match_scores)), 4),
        "model": WHISPER_MODEL,
        "device": WHISPER_DEVICE,
    }
    return output, confidence, diagnostics


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


@app.post("/align", response_model=AlignResponse)
async def align(req: AlignRequest, authorization: Optional[str] = Header(default=None)) -> AlignResponse:
    require_token(authorization)

    if not req.audioUrl:
        return AlignResponse(
            status="needs_review",
            confidence=0,
            engine="whisperx-v1",
            reason="audioUrl manquant : le worker doit analyser exactement l'audio utilisé par MixParty.",
            diagnostics={"videoId": req.videoId, "missing": "audioUrl"},
        )

    transcript = plain_lyrics(req)
    if not transcript:
        return AlignResponse(
            status="failed",
            confidence=0,
            engine="whisperx-v1",
            reason="Aucun texte de paroles exploitable.",
        )

    with tempfile.TemporaryDirectory(prefix="mixparty-karaoke-") as tmp:
        audio_path = Path(tmp) / "source.audio"
        await download_authorized_audio(req.audioUrl, audio_path)

        try:
            lines, confidence, diagnostics = align_with_whisperx(audio_path, transcript)
        except Exception as exc:
            return AlignResponse(
                status="failed",
                confidence=0,
                engine="whisperx-v1",
                reason=f"Erreur alignement: {exc}",
            )

    if len(lines) < 5:
        return AlignResponse(
            status="failed",
            confidence=confidence,
            lines=lines,
            engine="whisperx-v1",
            reason="Pas assez de lignes réalignées.",
            diagnostics=diagnostics,
        )

    status = "certified" if confidence >= MIN_CONFIDENCE else "needs_review"
    return AlignResponse(
        status=status,
        confidence=round(confidence, 2),
        offsetSeconds=0,
        lines=lines,
        engine=f"whisperx-v1/{WHISPER_MODEL}",
        reason=(
            "Alignement sur l'audio réel validé automatiquement."
            if status == "certified"
            else "Alignement obtenu mais confiance insuffisante pour publication automatique."
        ),
        diagnostics=diagnostics,
    )
