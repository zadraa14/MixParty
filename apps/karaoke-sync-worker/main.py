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
    engine: str = "faster-whisper-v1.7"
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


def parse_lrc_reference(synced_lyrics: str) -> list[dict[str, Any]]:
    """
    Parse les timestamps LRCLIB d'origine.
    Format attendu : [mm:ss.xx] texte
    """
    output: list[dict[str, Any]] = []

    for raw_line in (synced_lyrics or "").splitlines():
        match = re.match(
            r"^\s*\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*?)\s*$",
            raw_line,
        )
        if not match:
            continue

        minutes = int(match.group(1))
        seconds = int(match.group(2))
        fraction_raw = match.group(3) or "0"
        fraction = int(fraction_raw) / (10 ** len(fraction_raw))
        text = (match.group(4) or "").strip()

        if not text:
            continue

        output.append({
            "time": round(minutes * 60 + seconds + fraction, 3),
            "text": text,
            "normalized": normalize_text(text),
        })

    return output


def detect_duplicate_aligned_lines(lines: list[AlignedLine]) -> dict[str, Any]:
    """
    V1.7 :
    un refrain répété n'est PAS un doublon suspect.

    On ne signale une répétition que si :
    - le texte normalisé est identique
    - et la même ligne réapparaît à moins de 2,25 s

    Cela cible surtout les doubles rattachements artificiels d'une même ligne.
    """
    seen: dict[str, list[float]] = {}
    duplicate_pairs = []

    for line in lines:
        key = normalize_text(line.text)
        if not key:
            continue

        previous_times = seen.setdefault(key, [])
        for previous in previous_times:
            gap = line.time - previous
            if 0 < gap < 2.25:
                duplicate_pairs.append({
                    "text": line.text,
                    "firstTime": round(previous, 3),
                    "secondTime": round(line.time, 3),
                    "gapSeconds": round(gap, 3),
                })
        previous_times.append(line.time)

    return {
        "count": len(duplicate_pairs),
        "pairs": duplicate_pairs[:12],
        "suspect": len(duplicate_pairs) > 0,
        "rule": "same normalized line repeated within 2.25 seconds",
    }


def compare_with_lrclib(
    aligned_lines: list[AlignedLine],
    reference_lines: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Compare, ligne par ligne, les timings recalculés à LRCLIB.
    Le matching se fait séquentiellement par texte normalisé, puis fuzzy fallback.
    """
    import difflib
    import statistics

    if not aligned_lines or not reference_lines:
        return {
            "available": False,
            "matchedLineCount": 0,
            "comparisons": [],
        }

    comparisons = []
    ref_cursor = 0

    for aligned in aligned_lines:
        target = normalize_text(aligned.text)
        if not target:
            continue

        best = None
        search_end = min(len(reference_lines), ref_cursor + 8)

        # Exact normalized match first.
        for idx in range(ref_cursor, search_end):
            ref = reference_lines[idx]
            if ref["normalized"] == target:
                best = (1.0, idx, ref)
                break

        # Fuzzy fallback when wording differs slightly.
        if best is None:
            for idx in range(ref_cursor, search_end):
                ref = reference_lines[idx]
                score = difflib.SequenceMatcher(
                    None,
                    target,
                    ref["normalized"],
                ).ratio()
                if best is None or score > best[0]:
                    best = (score, idx, ref)

        if best is None or best[0] < 0.58:
            continue

        score, idx, ref = best
        delta = float(aligned.time) - float(ref["time"])

        comparisons.append({
            "text": aligned.text,
            "lrclibTime": round(float(ref["time"]), 3),
            "engineTime": round(float(aligned.time), 3),
            "deltaSeconds": round(delta, 3),
            "absoluteDeltaSeconds": round(abs(delta), 3),
            "textMatch": round(float(score), 4),
        })

        ref_cursor = max(ref_cursor, idx + 1)

    abs_deltas = [x["absoluteDeltaSeconds"] for x in comparisons]
    signed_deltas = [x["deltaSeconds"] for x in comparisons]

    if not abs_deltas:
        return {
            "available": True,
            "matchedLineCount": 0,
            "comparisons": [],
        }

    within_025 = sum(1 for x in abs_deltas if x <= 0.25) / len(abs_deltas)
    within_050 = sum(1 for x in abs_deltas if x <= 0.50) / len(abs_deltas)
    within_075 = sum(1 for x in abs_deltas if x <= 0.75) / len(abs_deltas)
    within_100 = sum(1 for x in abs_deltas if x <= 1.00) / len(abs_deltas)

    median_abs = statistics.median(abs_deltas)
    mean_abs = sum(abs_deltas) / len(abs_deltas)
    median_signed = statistics.median(signed_deltas)

    return {
        "available": True,
        "matchedLineCount": len(comparisons),
        "referenceLineCount": len(reference_lines),
        "comparisonCoverage": round(len(comparisons) / max(1, len(reference_lines)), 4),
        "medianAbsoluteDeltaSeconds": round(float(median_abs), 3),
        "meanAbsoluteDeltaSeconds": round(float(mean_abs), 3),
        "medianSignedDeltaSeconds": round(float(median_signed), 3),
        "within025": round(within_025, 4),
        "within050": round(within_050, 4),
        "within075": round(within_075, 4),
        "within100": round(within_100, 4),
        "comparisons": comparisons[:80],
    }


def robust_global_lrclib_offset(delta_diag: dict[str, Any]) -> Optional[float]:
    """
    Estime un offset global Engine - LRCLIB uniquement avec les lignes déjà fiables.
    On évite ainsi d'utiliser directement les timestamps LRCLIB ligne par ligne.
    """
    import statistics

    comparisons = delta_diag.get("comparisons") or []
    trusted = [
        float(item.get("deltaSeconds"))
        for item in comparisons
        if item.get("deltaSeconds") is not None
        and abs(float(item.get("deltaSeconds"))) <= 0.50
    ]

    if len(trusted) < 3:
        return None

    return float(statistics.median(trusted))


def local_refine_lines(
    words: list[dict[str, Any]],
    lines: list[AlignedLine],
    transcript: str,
    reference_lines: list[dict[str, Any]],
    delta_diag: dict[str, Any],
) -> tuple[list[AlignedLine], dict[str, Any]]:
    """
    V1.7 Local Refinement

    Pour les lignes avec un écart LRCLIB > 0,75 s :
    - on calcule un offset global robuste à partir des bonnes lignes
    - on prédit une zone temporelle attendue
    - on rescane uniquement une petite fenêtre de mots autour de cette zone
    - on remplace le timing seulement si le nouveau matching texte est convaincant
      ET améliore nettement la cohérence temporelle.
    """
    import difflib

    if not lines or not reference_lines:
        return lines, {
            "enabled": False,
            "reason": "no-lines-or-reference",
            "refinedCount": 0,
            "attemptedCount": 0,
        }

    global_offset = robust_global_lrclib_offset(delta_diag)
    if global_offset is None:
        return lines, {
            "enabled": False,
            "reason": "not-enough-trusted-anchors",
            "refinedCount": 0,
            "attemptedCount": 0,
        }

    comparisons = delta_diag.get("comparisons") or []
    by_text: dict[str, list[dict[str, Any]]] = {}
    for item in comparisons:
        by_text.setdefault(normalize_text(str(item.get("text") or "")), []).append(item)

    refined: list[AlignedLine] = []
    attempted = 0
    changed = 0
    details = []

    # Index temporel des mots, déjà triés.
    word_times = [float(w["start"]) for w in words]

    for line in lines:
        norm_line = normalize_text(line.text)
        candidate_comparisons = by_text.get(norm_line) or []

        # Prend la comparaison la plus proche du timing actuel.
        comp = None
        if candidate_comparisons:
            comp = min(
                candidate_comparisons,
                key=lambda item: abs(
                    float(item.get("engineTime") or 0) - float(line.time)
                ),
            )

        if not comp or float(comp.get("absoluteDeltaSeconds") or 0) <= 0.75:
            refined.append(line)
            continue

        attempted += 1

        ref_time = float(comp["lrclibTime"])
        predicted_time = ref_time + global_offset

        # Fenêtre étroite autour du timing attendu.
        left_time = predicted_time - 2.25
        right_time = predicted_time + 2.25

        candidate_word_indices = [
            idx
            for idx, t in enumerate(word_times)
            if left_time <= t <= right_time
        ]

        if not candidate_word_indices:
            refined.append(line)
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "no-word-window",
                "oldTime": round(float(line.time), 3),
                "predictedTime": round(predicted_time, 3),
            })
            continue

        expected_tokens = normalize_text(line.text).split()
        expected = " ".join(expected_tokens)
        strong_tokens = [t for t in expected_tokens if len(t) >= 4] or expected_tokens

        start_min = max(0, min(candidate_word_indices) - 2)
        start_max = min(len(words) - 1, max(candidate_word_indices) + 2)
        min_len = max(1, len(expected_tokens) - 4)
        max_len = len(expected_tokens) + 5

        best = None

        for start_idx in range(start_min, start_max + 1):
            if abs(float(words[start_idx]["start"]) - predicted_time) > 2.75:
                continue

            for length in range(min_len, max_len + 1):
                end_idx = start_idx + length
                if end_idx > len(words):
                    break

                candidate_tokens = [
                    normalize_text(str(w["word"]))
                    for w in words[start_idx:end_idx]
                ]
                candidate_text = " ".join(candidate_tokens)

                text_score = difflib.SequenceMatcher(
                    None,
                    expected,
                    candidate_text,
                ).ratio()

                candidate_set = set(candidate_tokens)
                matched_anchors = sum(
                    1 for token in strong_tokens if token in candidate_set
                )
                anchor_score = (
                    matched_anchors / len(strong_tokens)
                    if strong_tokens
                    else 0.0
                )

                timing_distance = abs(
                    float(words[start_idx]["start"]) - predicted_time
                )
                timing_score = max(0.0, 1.0 - timing_distance / 2.75)

                combined = (
                    text_score * 0.52
                    + anchor_score * 0.30
                    + timing_score * 0.18
                )

                if best is None or combined > best[0]:
                    best = (
                        combined,
                        text_score,
                        anchor_score,
                        timing_distance,
                        start_idx,
                    )

        if not best:
            refined.append(line)
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "no-local-match",
                "oldTime": round(float(line.time), 3),
                "predictedTime": round(predicted_time, 3),
            })
            continue

        combined, text_score, anchor_score, timing_distance, start_idx = best
        new_time = float(words[start_idx]["start"])

        old_distance = abs(float(line.time) - predicted_time)
        improvement = old_distance - abs(new_time - predicted_time)

        # Très conservateur :
        # on ne bouge la ligne que si le nouveau choix est lexicalement crédible
        # et gagne au moins 0,30 s sur la cohérence attendue.
        should_change = (
            combined >= 0.62
            and (text_score >= 0.50 or anchor_score >= 0.50)
            and improvement >= 0.30
        )

        if should_change:
            refined.append(
                AlignedLine(
                    time=round(new_time, 3),
                    text=line.text,
                )
            )
            changed += 1
            details.append({
                "text": line.text,
                "changed": True,
                "oldTime": round(float(line.time), 3),
                "newTime": round(new_time, 3),
                "predictedTime": round(predicted_time, 3),
                "improvementSeconds": round(improvement, 3),
                "textScore": round(text_score, 4),
                "anchorScore": round(anchor_score, 4),
                "combinedScore": round(combined, 4),
            })
        else:
            refined.append(line)
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "candidate-not-strong-enough",
                "oldTime": round(float(line.time), 3),
                "candidateTime": round(new_time, 3),
                "predictedTime": round(predicted_time, 3),
                "improvementSeconds": round(improvement, 3),
                "textScore": round(text_score, 4),
                "anchorScore": round(anchor_score, 4),
                "combinedScore": round(combined, 4),
            })

    # Sécurité : timestamps strictement croissants.
    monotonic = all(
        refined[i].time < refined[i + 1].time
        for i in range(len(refined) - 1)
    )

    if not monotonic:
        return lines, {
            "enabled": True,
            "applied": False,
            "reason": "refinement-broke-monotonicity",
            "attemptedCount": attempted,
            "refinedCount": 0,
            "globalOffsetSeconds": round(global_offset, 3),
            "details": details,
        }

    return refined, {
        "enabled": True,
        "applied": changed > 0,
        "attemptedCount": attempted,
        "refinedCount": changed,
        "globalOffsetSeconds": round(global_offset, 3),
        "details": details,
    }


def lrclib_timing_score(delta_diag: dict[str, Any]) -> float:
    """
    Score 0..1, utilisé comme indicateur de proximité LRCLIB.
    Ce n'est PAS une vérité absolue : LRCLIB peut lui-même être décalé.
    """
    if not delta_diag.get("available") or not delta_diag.get("matchedLineCount"):
        return 0.0

    within_025 = float(delta_diag.get("within025") or 0)
    within_050 = float(delta_diag.get("within050") or 0)
    within_075 = float(delta_diag.get("within075") or 0)
    coverage = float(delta_diag.get("comparisonCoverage") or 0)

    return max(
        0.0,
        min(
            1.0,
            within_025 * 0.35
            + within_050 * 0.30
            + within_075 * 0.20
            + coverage * 0.15,
        ),
    )


def process_audio(audio_path: Path, transcript: str, synced_lyrics: str = "") -> AlignResponse:
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

    lrclib_reference = parse_lrc_reference(synced_lyrics)

    # 1) diagnostic initial
    lrclib_delta_before = compare_with_lrclib(lines, lrclib_reference)

    # 2) correction locale uniquement sur les gros écarts
    refined_lines, refinement = local_refine_lines(
        words,
        lines,
        transcript,
        lrclib_reference,
        lrclib_delta_before,
    )

    # 3) diagnostics finaux après éventuelle correction
    lines = refined_lines
    lrclib_delta = compare_with_lrclib(lines, lrclib_reference)
    duplicates = detect_duplicate_aligned_lines(lines)
    lrclib_score = lrclib_timing_score(lrclib_delta)

    # Bonus croisé LRCLIB volontairement petit et plafonné.
    if lrclib_delta.get("available") and lrclib_delta.get("matchedLineCount"):
        confidence = min(
            100.0,
            confidence + max(0.0, lrclib_score - 0.72) * 10.0
        )

    publishable = (
        confidence >= MIN_CONFIDENCE
        and diag["coverage"] >= 0.90
        and diag["timingContinuity"] >= 0.90
        and diag["cursorProgression"] >= 0.85
        and diag["monotonic"]
        and not duplicates["suspect"]
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
        "timingValidationVersion": "v1.7",
        "lrclibTimingScore": round(lrclib_score, 4),
        "lrclibDeltaBeforeRefinement": lrclib_delta_before,
        "lrclibDelta": lrclib_delta,
        "localRefinement": refinement,
        "duplicateLines": duplicates,
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
        "version": "1.7",
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
    synced_reference = ""
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
        synced_reference = synced

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

        result = process_audio(source, resolved_transcript, synced_reference)

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

