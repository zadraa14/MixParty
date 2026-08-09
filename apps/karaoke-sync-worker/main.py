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
    engine: str = "faster-whisper-v1.9"
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



def recover_intro_lines(
    words: list[dict[str, Any]],
    lines: list[AlignedLine],
    transcript: str,
    reference_lines: list[dict[str, Any]],
) -> tuple[list[AlignedLine], dict[str, Any]]:
    """
    V1.9 Intro Recovery

    Cible uniquement le début du morceau (0-15 s), là où Faster-Whisper
    peut rater les fragments très courts (ex: "A-B, C-D").

    Règles :
    - ne touche qu'aux 3 premières lignes LRCLIB
    - seulement si la ligne moteur est absente ou très éloignée (> 2,5 s)
    - recherche audio limitée à 0-15 s
    - accepte mieux les fragments courts, mais impose une cohérence stricte
      avec la ligne suivante
    - n'écrase jamais une ligne déjà correcte
    """
    import difflib

    if not words or not reference_lines:
        return lines, {
            "enabled": False,
            "reason": "no-words-or-reference",
            "attemptedCount": 0,
            "recoveredCount": 0,
        }

    working = [AlignedLine(time=float(line.time), text=line.text) for line in lines]
    details = []
    attempted = 0
    recovered = 0

    # index text -> list of line indices in current output
    current_by_text: dict[str, list[int]] = {}
    for idx, line in enumerate(working):
        current_by_text.setdefault(normalize_text(line.text), []).append(idx)

    intro_refs = [
        ref for ref in reference_lines[:3]
        if float(ref["time"]) <= 15.0
    ]

    for ref in intro_refs:
        ref_text = str(ref["text"])
        ref_norm = normalize_text(ref_text)
        ref_time = float(ref["time"])

        existing_indices = current_by_text.get(ref_norm) or []
        existing_idx = existing_indices[0] if existing_indices else None
        existing_time = (
            float(working[existing_idx].time)
            if existing_idx is not None
            else None
        )

        # Already good enough: keep it.
        if existing_time is not None and abs(existing_time - ref_time) <= 2.5:
            continue

        attempted += 1

        expected_tokens = ref_norm.split()
        if not expected_tokens:
            continue

        # Short fragments need a different strategy.
        is_short = len(expected_tokens) <= 4 or len(ref_norm) <= 14
        strong_tokens = [t for t in expected_tokens if len(t) >= 2] or expected_tokens

        # Search only in first 15 seconds.
        candidate_indices = [
            i for i, w in enumerate(words)
            if 0.0 <= float(w["start"]) <= 15.0
        ]

        if not candidate_indices:
            details.append({
                "text": ref_text,
                "changed": False,
                "reason": "no-intro-words",
            })
            continue

        start_min = min(candidate_indices)
        start_max = max(candidate_indices)
        min_len = max(1, len(expected_tokens) - 2)
        max_len = len(expected_tokens) + (3 if is_short else 4)

        best = None

        for start_idx in range(start_min, start_max + 1):
            start_time = float(words[start_idx]["start"])

            # The first lyric should not drift wildly from LRCLIB,
            # but allow a few seconds because LRCLIB itself may be imperfect.
            if abs(start_time - ref_time) > 4.5:
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
                    None, ref_norm, candidate_text
                ).ratio()

                candidate_set = set(candidate_tokens)
                anchor_score = (
                    sum(1 for t in strong_tokens if t in candidate_set)
                    / len(strong_tokens)
                    if strong_tokens
                    else 0.0
                )

                time_distance = abs(start_time - ref_time)
                timing_score = max(0.0, 1.0 - time_distance / 4.5)

                # For very short lyric fragments, lexical evidence is noisy.
                # Give a little more weight to timing and anchors.
                if is_short:
                    combined = (
                        text_score * 0.38
                        + anchor_score * 0.34
                        + timing_score * 0.28
                    )
                else:
                    combined = (
                        text_score * 0.50
                        + anchor_score * 0.30
                        + timing_score * 0.20
                    )

                if best is None or combined > best[0]:
                    best = (
                        combined,
                        text_score,
                        anchor_score,
                        timing_score,
                        start_idx,
                    )

        if not best:
            details.append({
                "text": ref_text,
                "changed": False,
                "reason": "no-intro-match",
                "lrclibTime": round(ref_time, 3),
            })
            continue

        combined, text_score, anchor_score, timing_score, start_idx = best
        new_time = float(words[start_idx]["start"])

        # Find the next current line after this intro item.
        next_times = sorted(
            float(line.time)
            for line in working
            if float(line.time) > new_time + 0.20
        )
        next_time = next_times[0] if next_times else None

        # Prevent overlap / impossible ordering.
        next_safe = next_time is None or new_time < next_time - 0.35

        if is_short:
            lexical_ok = (
                combined >= 0.48
                and (text_score >= 0.30 or anchor_score >= 0.34)
            )
        else:
            lexical_ok = (
                combined >= 0.60
                and (text_score >= 0.48 or anchor_score >= 0.50)
            )

        should_apply = lexical_ok and next_safe and new_time <= 15.0

        if not should_apply:
            details.append({
                "text": ref_text,
                "changed": False,
                "reason": "intro-candidate-rejected",
                "lrclibTime": round(ref_time, 3),
                "candidateTime": round(new_time, 3),
                "combinedScore": round(combined, 4),
                "textScore": round(text_score, 4),
                "anchorScore": round(anchor_score, 4),
                "timingScore": round(timing_score, 4),
                "nextSafe": next_safe,
            })
            continue

        if existing_idx is not None:
            old_time = float(working[existing_idx].time)
            working[existing_idx] = AlignedLine(
                time=round(new_time, 3),
                text=working[existing_idx].text,
            )
            action = "repositioned"
        else:
            old_time = None
            working.append(
                AlignedLine(time=round(new_time, 3), text=ref_text)
            )
            action = "inserted"

        recovered += 1
        details.append({
            "text": ref_text,
            "changed": True,
            "action": action,
            "oldTime": round(old_time, 3) if old_time is not None else None,
            "newTime": round(new_time, 3),
            "lrclibTime": round(ref_time, 3),
            "deltaSeconds": round(new_time - ref_time, 3),
            "combinedScore": round(combined, 4),
            "textScore": round(text_score, 4),
            "anchorScore": round(anchor_score, 4),
            "timingScore": round(timing_score, 4),
        })

    # Re-sort after possible insertion.
    working = sorted(working, key=lambda line: float(line.time))

    monotonic = all(
        working[i].time < working[i + 1].time
        for i in range(len(working) - 1)
    )

    if not monotonic:
        return lines, {
            "enabled": True,
            "applied": False,
            "reason": "intro-recovery-broke-monotonicity",
            "attemptedCount": attempted,
            "recoveredCount": 0,
            "details": details,
        }

    return working, {
        "enabled": True,
        "applied": recovered > 0,
        "attemptedCount": attempted,
        "recoveredCount": recovered,
        "details": details,
    }

def local_refine_lines(
    words: list[dict[str, Any]],
    lines: list[AlignedLine],
    transcript: str,
    reference_lines: list[dict[str, Any]],
    delta_diag: dict[str, Any],
) -> tuple[list[AlignedLine], dict[str, Any]]:
    """
    V1.8 Safe Local Refinement

    Règles :
    - aucune correction > 2.0 s
    - la correction doit améliorer la proximité avec la zone attendue
    - elle doit rester cohérente avec les lignes voisines
    - après correction, l'ordre des timestamps doit rester strictement croissant
    - la confiance sera recalculée après les corrections
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

    refined = [AlignedLine(time=float(line.time), text=line.text) for line in lines]
    attempted = 0
    changed = 0
    details = []

    word_times = [float(w["start"]) for w in words]

    for idx, line in enumerate(lines):
        norm_line = normalize_text(line.text)
        candidate_comparisons = by_text.get(norm_line) or []

        comp = None
        if candidate_comparisons:
            comp = min(
                candidate_comparisons,
                key=lambda item: abs(
                    float(item.get("engineTime") or 0) - float(line.time)
                ),
            )

        if not comp or float(comp.get("absoluteDeltaSeconds") or 0) <= 0.75:
            continue

        attempted += 1

        ref_time = float(comp["lrclibTime"])
        predicted_time = ref_time + global_offset

        # Narrow local window.
        left_time = predicted_time - 2.0
        right_time = predicted_time + 2.0

        candidate_word_indices = [
            wi for wi, t in enumerate(word_times) if left_time <= t <= right_time
        ]

        if not candidate_word_indices:
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

        start_min = max(0, min(candidate_word_indices) - 1)
        start_max = min(len(words) - 1, max(candidate_word_indices) + 1)
        min_len = max(1, len(expected_tokens) - 4)
        max_len = len(expected_tokens) + 5

        best = None

        for start_idx in range(start_min, start_max + 1):
            candidate_start = float(words[start_idx]["start"])
            move_amount = abs(candidate_start - float(line.time))

            # Hard safety limit.
            if move_amount > 2.0:
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
                anchor_score = (
                    sum(1 for token in strong_tokens if token in candidate_set)
                    / len(strong_tokens)
                    if strong_tokens
                    else 0.0
                )

                timing_distance = abs(candidate_start - predicted_time)
                timing_score = max(0.0, 1.0 - timing_distance / 2.0)

                combined = (
                    text_score * 0.55
                    + anchor_score * 0.30
                    + timing_score * 0.15
                )

                if best is None or combined > best[0]:
                    best = (
                        combined,
                        text_score,
                        anchor_score,
                        candidate_start,
                        move_amount,
                    )

        if not best:
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "no-safe-local-match",
                "oldTime": round(float(line.time), 3),
                "predictedTime": round(predicted_time, 3),
            })
            continue

        combined, text_score, anchor_score, new_time, move_amount = best

        old_distance = abs(float(line.time) - predicted_time)
        new_distance = abs(new_time - predicted_time)
        improvement = old_distance - new_distance

        # Neighbor consistency.
        prev_time = float(refined[idx - 1].time) if idx > 0 else None
        next_time = float(lines[idx + 1].time) if idx + 1 < len(lines) else None

        prev_ok = prev_time is None or new_time > prev_time + 0.20
        next_ok = next_time is None or new_time < next_time - 0.20

        should_change = (
            combined >= 0.64
            and (text_score >= 0.52 or anchor_score >= 0.50)
            and improvement >= 0.25
            and move_amount <= 2.0
            and prev_ok
            and next_ok
        )

        if should_change:
            refined[idx] = AlignedLine(time=round(new_time, 3), text=line.text)
            changed += 1
            details.append({
                "text": line.text,
                "changed": True,
                "oldTime": round(float(line.time), 3),
                "newTime": round(new_time, 3),
                "moveSeconds": round(move_amount, 3),
                "predictedTime": round(predicted_time, 3),
                "improvementSeconds": round(improvement, 3),
                "textScore": round(text_score, 4),
                "anchorScore": round(anchor_score, 4),
                "combinedScore": round(combined, 4),
                "neighborSafe": True,
            })
        else:
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "candidate-rejected-by-safety-rules",
                "oldTime": round(float(line.time), 3),
                "candidateTime": round(new_time, 3),
                "moveSeconds": round(move_amount, 3),
                "predictedTime": round(predicted_time, 3),
                "improvementSeconds": round(improvement, 3),
                "textScore": round(text_score, 4),
                "anchorScore": round(anchor_score, 4),
                "combinedScore": round(combined, 4),
                "prevSafe": prev_ok,
                "nextSafe": next_ok,
            })

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
        "maxMoveSeconds": 2.0,
        "details": details,
    }


def recompute_timing_confidence(
    base_diag: dict[str, Any],
    final_lines: list[AlignedLine],
    lrclib_delta: dict[str, Any],
    duplicates: dict[str, Any],
) -> tuple[float, dict[str, Any]]:
    """
    Recalcule la confiance APRÈS corrections.

    Le score final combine :
    - couverture
    - continuité temporelle réelle des lignes finales
    - progression
    - qualité lexicale
    - validation croisée LRCLIB
    - pénalité doublons
    """
    coverage = float(base_diag.get("coverage") or 0)
    progression = float(base_diag.get("cursorProgression") or 0)
    anchor_quality = float(base_diag.get("anchorQuality") or 0)
    similarity = float(base_diag.get("averageSimilarity") or 0)

    continuity_scores = []
    for i in range(len(final_lines) - 1):
        delta = float(final_lines[i + 1].time) - float(final_lines[i].time)
        if delta <= 0:
            continuity_scores.append(0.0)
        elif delta < 0.35:
            continuity_scores.append(0.35)
        elif delta <= 20:
            continuity_scores.append(1.0)
        elif delta <= 35:
            continuity_scores.append(0.75)
        else:
            continuity_scores.append(0.40)

    final_continuity = (
        sum(continuity_scores) / len(continuity_scores)
        if continuity_scores
        else 1.0
    )

    lrclib_score = lrclib_timing_score(lrclib_delta)

    score = (
        coverage * 0.34
        + final_continuity * 0.22
        + progression * 0.12
        + anchor_quality * 0.10
        + similarity * 0.08
        + lrclib_score * 0.14
    )

    if duplicates.get("suspect"):
        score -= min(0.08, 0.02 * int(duplicates.get("count") or 0))

    score = max(0.0, min(1.0, score))

    details = {
        "coverage": round(coverage, 4),
        "finalTimingContinuity": round(final_continuity, 4),
        "cursorProgression": round(progression, 4),
        "anchorQuality": round(anchor_quality, 4),
        "textSimilarity": round(similarity, 4),
        "lrclibTimingScore": round(lrclib_score, 4),
        "duplicatePenaltyApplied": bool(duplicates.get("suspect")),
        "weights": {
            "coverage": 0.34,
            "finalTimingContinuity": 0.22,
            "cursorProgression": 0.12,
            "anchorQuality": 0.10,
            "textSimilarity": 0.08,
            "lrclibTimingScore": 0.14,
        },
    }

    return score * 100.0, details


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

    # 2) récupération spéciale intro 0-15 s
    intro_lines, intro_recovery = recover_intro_lines(
        words,
        lines,
        transcript,
        lrclib_reference,
    )

    # 3) nouveau diagnostic après récupération intro
    lrclib_delta_after_intro = compare_with_lrclib(
        intro_lines,
        lrclib_reference,
    )

    # 4) correction locale uniquement sur les gros écarts restants
    refined_lines, refinement = local_refine_lines(
        words,
        intro_lines,
        transcript,
        lrclib_reference,
        lrclib_delta_after_intro,
    )

    # 5) diagnostics finaux après éventuelle correction
    lines = refined_lines
    lrclib_delta = compare_with_lrclib(lines, lrclib_reference)
    duplicates = detect_duplicate_aligned_lines(lines)
    lrclib_score = lrclib_timing_score(lrclib_delta)

    # V1.8 : recalcul complet APRES correction locale.
    confidence, final_confidence_diag = recompute_timing_confidence(
        diag,
        lines,
        lrclib_delta,
        duplicates,
    )

    publishable = (
        confidence >= MIN_CONFIDENCE
        and diag["coverage"] >= 0.90
        and final_confidence_diag["finalTimingContinuity"] >= 0.90
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
        "timingValidationVersion": "v1.9",
        "lrclibTimingScore": round(lrclib_score, 4),
        "lrclibDeltaBeforeRefinement": lrclib_delta_before,
        "lrclibDeltaAfterIntroRecovery": lrclib_delta_after_intro,
        "lrclibDelta": lrclib_delta,
        "introRecovery": intro_recovery,
        "localRefinement": refinement,
        "finalConfidence": final_confidence_diag,
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
        "version": "1.9",
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

