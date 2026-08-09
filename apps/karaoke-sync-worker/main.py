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

app = FastAPI(title="MixParty Karaoke Sync Worker", version="2.2")

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
    engine: str = "faster-whisper-v2.2"
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



def recover_edge_segments(
    words: list[dict[str, Any]],
    lines: list[AlignedLine],
    reference_lines: list[dict[str, Any]],
    delta_diag: dict[str, Any],
) -> tuple[list[AlignedLine], dict[str, Any]]:
    """
    V2.2 Edge Recovery générique.

    Corrige uniquement les lignes problématiques situées aux bords du morceau,
    là où Block/Segment Recovery manque naturellement d'une ancre avant ou après.

    Principes :
    - cible les 3 premières et 3 dernières comparaisons
    - uniquement |delta| >= 0.75 s
    - exige une ancre intérieure fiable <= 0.50 s
    - déplacement max 2.25 s
    - recherche audio strictement bornée
    - preuve lexicale + amélioration temporelle obligatoires
    - ne modifie jamais une ligne déjà correcte
    """
    import difflib

    comparisons = delta_diag.get("comparisons") or []
    if not words or not lines or not comparisons:
        return lines, {
            "enabled": False,
            "reason": "missing-input",
            "attemptedCount": 0,
            "recoveredCount": 0,
        }

    working = [AlignedLine(time=float(x.time), text=x.text) for x in lines]
    details = []
    attempted = 0
    recovered = 0

    edge_positions = sorted(
        set(
            list(range(min(3, len(comparisons))))
            + list(range(max(0, len(comparisons) - 3), len(comparisons)))
        )
    )

    def find_working_index(text: str, engine_time: float):
        norm = normalize_text(text)
        choices = [
            (idx, abs(float(line.time) - engine_time))
            for idx, line in enumerate(working)
            if normalize_text(line.text) == norm
        ]
        return min(choices, key=lambda x: x[1])[0] if choices else None

    for ci in edge_positions:
        comp = comparisons[ci]
        abs_delta = float(comp.get("absoluteDeltaSeconds") or 0)
        if abs_delta < 0.75:
            continue

        attempted += 1
        old_time = float(comp["engineTime"])
        ref_time = float(comp["lrclibTime"])
        text = str(comp.get("text") or "")
        idx = find_working_index(text, old_time)

        if idx is None:
            details.append({
                "text": text,
                "changed": False,
                "reason": "line-not-found",
            })
            continue

        is_start_edge = ci < 3
        is_end_edge = ci >= len(comparisons) - 3

        # Find the nearest trusted inner anchor.
        trusted = None
        if is_start_edge:
            for j in range(ci + 1, len(comparisons)):
                c = comparisons[j]
                if float(c.get("absoluteDeltaSeconds") or 99) <= 0.50:
                    trusted = c
                    break
        elif is_end_edge:
            for j in range(ci - 1, -1, -1):
                c = comparisons[j]
                if float(c.get("absoluteDeltaSeconds") or 99) <= 0.50:
                    trusted = c
                    break

        if trusted is None:
            details.append({
                "text": text,
                "changed": False,
                "reason": "no-trusted-inner-anchor",
                "oldTime": round(old_time, 3),
            })
            continue

        anchor_offset = (
            float(trusted["engineTime"]) - float(trusted["lrclibTime"])
        )
        predicted = ref_time + anchor_offset

        # The edge window is bounded by the neighboring actual line and ±2.25 s.
        lo = predicted - 2.25
        hi = predicted + 2.25

        if idx > 0:
            lo = max(lo, float(working[idx - 1].time) + 0.20)
        else:
            lo = max(0.0, lo)

        if idx + 1 < len(working):
            hi = min(hi, float(working[idx + 1].time) - 0.20)

        if hi <= lo:
            details.append({
                "text": text,
                "changed": False,
                "reason": "invalid-edge-window",
                "oldTime": round(old_time, 3),
            })
            continue

        expected_tokens = normalize_text(text).split()
        if not expected_tokens:
            continue

        expected = " ".join(expected_tokens)
        strong = [t for t in expected_tokens if len(t) >= 3] or expected_tokens
        short_fragment = len(expected_tokens) <= 4 or len(expected) <= 14

        best = None
        min_len = max(1, len(expected_tokens) - 3)
        max_len = len(expected_tokens) + 4

        for wi, word in enumerate(words):
            start_time = float(word["start"])
            if not (lo <= start_time <= hi):
                continue

            move = abs(start_time - old_time)
            if move > 2.25:
                continue

            for ln in range(min_len, max_len + 1):
                if wi + ln > len(words):
                    break

                cand_tokens = [
                    normalize_text(str(x["word"]))
                    for x in words[wi:wi + ln]
                ]
                candidate = " ".join(cand_tokens)

                text_score = difflib.SequenceMatcher(
                    None, expected, candidate
                ).ratio()

                cand_set = set(cand_tokens)
                anchor_score = (
                    sum(1 for t in strong if t in cand_set) / len(strong)
                    if strong else 0.0
                )
                timing_score = max(
                    0.0,
                    1.0 - abs(start_time - predicted) / 2.25,
                )

                if short_fragment:
                    combined = (
                        text_score * 0.42
                        + anchor_score * 0.34
                        + timing_score * 0.24
                    )
                else:
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
                        start_time,
                        move,
                    )

        if best is None:
            details.append({
                "text": text,
                "changed": False,
                "reason": "no-edge-candidate",
            })
            continue

        combined, text_score, anchor_score, new_time, move = best
        old_error = abs(old_time - predicted)
        new_error = abs(new_time - predicted)
        improvement = old_error - new_error

        prev_ok = idx == 0 or new_time > float(working[idx - 1].time) + 0.20
        next_ok = (
            idx + 1 >= len(working)
            or new_time < float(working[idx + 1].time) - 0.20
        )

        if short_fragment:
            lexical_ok = (
                combined >= 0.54
                and (text_score >= 0.34 or anchor_score >= 0.45)
            )
        else:
            lexical_ok = (
                combined >= 0.65
                and text_score >= 0.50
                and anchor_score >= 0.45
            )

        should_apply = (
            lexical_ok
            and improvement >= 0.35
            and move <= 2.25
            and prev_ok
            and next_ok
        )

        if not should_apply:
            details.append({
                "text": text,
                "changed": False,
                "reason": "edge-candidate-rejected",
                "oldTime": round(old_time, 3),
                "candidateTime": round(new_time, 3),
                "predictedTime": round(predicted, 3),
                "moveSeconds": round(move, 3),
                "improvementSeconds": round(improvement, 3),
                "textScore": round(text_score, 4),
                "anchorScore": round(anchor_score, 4),
                "combinedScore": round(combined, 4),
            })
            continue

        working[idx] = AlignedLine(
            time=round(new_time, 3),
            text=working[idx].text,
        )
        recovered += 1
        details.append({
            "text": text,
            "changed": True,
            "edge": "start" if is_start_edge else "end",
            "oldTime": round(old_time, 3),
            "newTime": round(new_time, 3),
            "lrclibTime": round(ref_time, 3),
            "predictedTime": round(predicted, 3),
            "moveSeconds": round(move, 3),
            "improvementSeconds": round(improvement, 3),
            "textScore": round(text_score, 4),
            "anchorScore": round(anchor_score, 4),
            "combinedScore": round(combined, 4),
        })

    monotonic = all(
        float(working[i].time) < float(working[i + 1].time)
        for i in range(len(working) - 1)
    )

    if not monotonic:
        return lines, {
            "enabled": True,
            "applied": False,
            "reason": "edge-recovery-broke-monotonicity",
            "attemptedCount": attempted,
            "recoveredCount": 0,
            "details": details,
        }

    return working, {
        "enabled": True,
        "applied": recovered > 0,
        "attemptedCount": attempted,
        "recoveredCount": recovered,
        "maxMoveSeconds": 2.25,
        "details": details,
    }

def recover_suspect_blocks(
    words: list[dict[str, Any]],
    lines: list[AlignedLine],
    reference_lines: list[dict[str, Any]],
    delta_diag: dict[str, Any],
) -> tuple[list[AlignedLine], dict[str, Any]]:
    """V2.1 Block Recovery: recale de petits blocs suspects entre deux ancres fiables."""
    import difflib

    comparisons = delta_diag.get("comparisons") or []
    if not words or not lines or len(comparisons) < 4:
        return lines, {"enabled": False, "reason": "missing-input", "attemptedBlocks": 0, "recoveredBlocks": 0}

    # Les comparaisons sont déjà dans l'ordre LRCLIB. On ne cible que 2 à 4
    # lignes consécutives franchement suspectes, encadrées par deux ancres <= 0,50 s.
    suspect = [float(c.get("absoluteDeltaSeconds") or 0) >= 0.75 for c in comparisons]
    blocks = []
    i = 0
    while i < len(comparisons):
        if not suspect[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(comparisons) and suspect[j + 1]:
            j += 1
        if 2 <= (j - i + 1) <= 4 and i > 0 and j + 1 < len(comparisons):
            left = comparisons[i - 1]
            right = comparisons[j + 1]
            if float(left.get("absoluteDeltaSeconds") or 99) <= 0.50 and float(right.get("absoluteDeltaSeconds") or 99) <= 0.50:
                blocks.append((i, j, left, right))
        i = j + 1

    if not blocks:
        return lines, {"enabled": True, "applied": False, "reason": "no-anchored-suspect-block", "attemptedBlocks": 0, "recoveredBlocks": 0, "details": []}

    working = [AlignedLine(time=float(x.time), text=x.text) for x in lines]
    details = []
    recovered_blocks = 0
    recovered_lines = 0

    def find_line_index(text: str, engine_time: float):
        norm = normalize_text(text)
        cand = [(k, abs(float(x.time)-engine_time)) for k,x in enumerate(working) if normalize_text(x.text)==norm]
        return min(cand, key=lambda z:z[1])[0] if cand else None

    for bi, (start, end, left_anchor, right_anchor) in enumerate(blocks[:3]):
        block = comparisons[start:end+1]
        left_off = float(left_anchor["engineTime"]) - float(left_anchor["lrclibTime"])
        right_off = float(right_anchor["engineTime"]) - float(right_anchor["lrclibTime"])
        ref_left = float(left_anchor["lrclibTime"])
        ref_right = float(right_anchor["lrclibTime"])
        proposals = []
        rejected = None

        for c in block:
            text = str(c.get("text") or "")
            norm = normalize_text(text)
            tokens = norm.split()
            if not tokens:
                rejected = "empty-text"; break
            rt = float(c["lrclibTime"])
            frac = 0.5 if ref_right <= ref_left else max(0.0, min(1.0, (rt-ref_left)/(ref_right-ref_left)))
            predicted = rt + left_off + (right_off-left_off)*frac
            old = float(c["engineTime"])
            # Fenêtre assez large pour récupérer un bloc, mais toujours bornée par les ancres.
            lo = max(float(left_anchor["engineTime"])+0.12, predicted-2.50)
            hi = min(float(right_anchor["engineTime"])-0.12, predicted+2.50)
            expected = " ".join(tokens)
            strong = [t for t in tokens if len(t)>=4] or tokens
            best = None
            for wi,w in enumerate(words):
                st=float(w["start"])
                if st < lo or st > hi: continue
                for ln in range(max(1,len(tokens)-4), len(tokens)+6):
                    if wi+ln>len(words): break
                    ct=[normalize_text(str(x["word"])) for x in words[wi:wi+ln]]
                    cand=" ".join(ct)
                    text_score=difflib.SequenceMatcher(None, expected, cand).ratio()
                    aset=set(ct)
                    anchor_score=sum(1 for t in strong if t in aset)/len(strong)
                    timing_score=max(0.0,1.0-abs(st-predicted)/2.50)
                    score=text_score*.62+anchor_score*.28+timing_score*.10
                    if best is None or score>best[0]: best=(score,text_score,anchor_score,st)
            if best is None or best[0] < .64 or best[1] < .48 or best[2] < .42:
                rejected = "weak-block-candidate"; break
            score,ts,ans,new=best
            # Le nouveau point doit améliorer le modèle local d'au moins 0,25 s pour les gros écarts.
            improvement=abs(old-predicted)-abs(new-predicted)
            if improvement < .25:
                rejected = "insufficient-block-improvement"; break
            proposals.append((c,new,score,ts,ans,predicted,old))

        # Validation conjointe: ordre strict + indices réels trouvés + pas de collision.
        if not rejected:
            new_times=[x[1] for x in proposals]
            if any(new_times[k] >= new_times[k+1]-0.12 for k in range(len(new_times)-1)):
                rejected="block-non-monotonic"
        indices=[]
        if not rejected:
            for c,*_ in proposals:
                idx=find_line_index(str(c.get("text") or ""), float(c["engineTime"]))
                if idx is None: rejected="line-not-found"; break
                indices.append(idx)
            if len(set(indices)) != len(indices): rejected="duplicate-line-index"

        if rejected:
            details.append({"block": bi+1, "changed": False, "reason": rejected, "lineCount": len(block)})
            continue

        # Vérifie aussi les voisins extérieurs dans la liste alignée.
        ordered=sorted(zip(indices, proposals), key=lambda z:z[0])
        safe=True
        for pos,(idx,prop) in enumerate(ordered):
            nt=prop[1]
            prev_t = ordered[pos-1][1][1] if pos else (float(working[idx-1].time) if idx>0 else -1e9)
            next_t = ordered[pos+1][1][1] if pos+1<len(ordered) else (float(working[idx+1].time) if idx+1<len(working) else 1e9)
            if nt <= prev_t+0.12 or nt >= next_t-0.12: safe=False; break
        if not safe:
            details.append({"block": bi+1,"changed":False,"reason":"neighbor-order-guard","lineCount":len(block)})
            continue

        line_details=[]
        for idx,prop in ordered:
            c,new,score,ts,ans,predicted,old=prop
            working[idx]=AlignedLine(time=round(new,3), text=working[idx].text)
            line_details.append({"text":working[idx].text,"oldTime":round(old,3),"newTime":round(new,3),"lrclibTime":round(float(c["lrclibTime"]),3),"predictedTime":round(predicted,3),"combinedScore":round(score,4),"textScore":round(ts,4),"anchorScore":round(ans,4)})
        recovered_blocks += 1
        recovered_lines += len(ordered)
        details.append({"block":bi+1,"changed":True,"lineCount":len(ordered),"lines":line_details})

    monotonic=all(float(working[k].time)<float(working[k+1].time) for k in range(len(working)-1))
    if not monotonic:
        return lines,{"enabled":True,"applied":False,"reason":"block-recovery-broke-monotonicity","attemptedBlocks":len(blocks),"recoveredBlocks":0,"recoveredLines":0,"details":details}
    return working,{"enabled":True,"applied":recovered_blocks>0,"attemptedBlocks":len(blocks),"recoveredBlocks":recovered_blocks,"recoveredLines":recovered_lines,"details":details}


def recover_isolated_segments(
    words: list[dict[str, Any]],
    lines: list[AlignedLine],
    reference_lines: list[dict[str, Any]],
    delta_diag: dict[str, Any],
) -> tuple[list[AlignedLine], dict[str, Any]]:
    """
    V2.0 Segment Recovery générique.

    But:
    corriger automatiquement une ligne isolée manifestement décalée lorsque
    les lignes LRCLIB voisines donnent des ancres fiables.

    Sécurité:
    - aucune règle spécifique à un artiste/titre
    - ne traite que les lignes avec |delta| >= 0.75 s
    - exige au moins une ancre voisine fiable; deux ancres si déplacement > 1.25 s
    - fenêtre de recherche bornée par les lignes voisines
    - déplacement maximal 2.25 s
    - amélioration minimale 0.35 s
    - preuve lexicale obligatoire
    - ordre temporel strict conservé
    - maximum 4 corrections par morceau
    """
    import difflib

    if not words or not lines or not reference_lines:
        return lines, {
            "enabled": False,
            "reason": "missing-input",
            "attemptedCount": 0,
            "recoveredCount": 0,
        }

    comparisons = delta_diag.get("comparisons") or []
    if not comparisons:
        return lines, {
            "enabled": False,
            "reason": "no-comparisons",
            "attemptedCount": 0,
            "recoveredCount": 0,
        }

    working = [AlignedLine(time=float(x.time), text=x.text) for x in lines]
    word_times = [float(w["start"]) for w in words]
    details = []
    attempted = 0
    recovered = 0
    MAX_RECOVERIES = 4

    # Map normalized text to comparison candidates.
    comp_by_text: dict[str, list[dict[str, Any]]] = {}
    for c in comparisons:
        comp_by_text.setdefault(
            normalize_text(str(c.get("text") or "")), []
        ).append(c)

    for idx, line in enumerate(list(working)):
        if recovered >= MAX_RECOVERIES:
            break

        norm = normalize_text(line.text)
        candidates = comp_by_text.get(norm) or []
        if not candidates:
            continue

        comp = min(
            candidates,
            key=lambda c: abs(
                float(c.get("engineTime") or 0.0) - float(line.time)
            ),
        )

        abs_delta = float(comp.get("absoluteDeltaSeconds") or 0.0)
        if abs_delta < 0.75:
            continue

        attempted += 1
        ref_time = float(comp["lrclibTime"])
        old_time = float(line.time)

        # Determine trusted neighboring anchors from LRCLIB comparison.
        prev_comp = None
        next_comp = None

        for j in range(idx - 1, -1, -1):
            prev_norm = normalize_text(working[j].text)
            prev_candidates = comp_by_text.get(prev_norm) or []
            if prev_candidates:
                pc = min(
                    prev_candidates,
                    key=lambda c: abs(
                        float(c.get("engineTime") or 0.0)
                        - float(working[j].time)
                    ),
                )
                if float(pc.get("absoluteDeltaSeconds") or 99) <= 0.50:
                    prev_comp = pc
                    break

        for j in range(idx + 1, len(working)):
            next_norm = normalize_text(working[j].text)
            next_candidates = comp_by_text.get(next_norm) or []
            if next_candidates:
                nc = min(
                    next_candidates,
                    key=lambda c: abs(
                        float(c.get("engineTime") or 0.0)
                        - float(working[j].time)
                    ),
                )
                if float(nc.get("absoluteDeltaSeconds") or 99) <= 0.50:
                    next_comp = nc
                    break

        trusted_anchor_count = int(prev_comp is not None) + int(next_comp is not None)

        if trusted_anchor_count == 0:
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "no-trusted-neighbor-anchor",
                "oldTime": round(old_time, 3),
                "lrclibTime": round(ref_time, 3),
            })
            continue

        # Estimate local offset from trusted neighboring anchors.
        anchor_offsets = []
        if prev_comp is not None:
            anchor_offsets.append(
                float(prev_comp["engineTime"]) - float(prev_comp["lrclibTime"])
            )
        if next_comp is not None:
            anchor_offsets.append(
                float(next_comp["engineTime"]) - float(next_comp["lrclibTime"])
            )

        local_offset = sum(anchor_offsets) / len(anchor_offsets)
        predicted_time = ref_time + local_offset

        # Search window constrained by neighbors and ±2.25s around predicted point.
        left = predicted_time - 2.25
        right = predicted_time + 2.25

        if idx > 0:
            left = max(left, float(working[idx - 1].time) + 0.20)
        if idx + 1 < len(working):
            right = min(right, float(working[idx + 1].time) - 0.20)

        candidate_indices = [
            wi for wi, t in enumerate(word_times)
            if left <= t <= right
        ]

        if not candidate_indices:
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "no-word-in-bounded-window",
                "oldTime": round(old_time, 3),
                "predictedTime": round(predicted_time, 3),
            })
            continue

        expected_tokens = norm.split()
        expected = " ".join(expected_tokens)
        strong_tokens = [t for t in expected_tokens if len(t) >= 4] or expected_tokens

        start_min = max(0, min(candidate_indices) - 1)
        start_max = min(len(words) - 1, max(candidate_indices) + 1)
        min_len = max(1, len(expected_tokens) - 4)
        max_len = len(expected_tokens) + 5

        best = None

        for start_idx in range(start_min, start_max + 1):
            candidate_start = float(words[start_idx]["start"])
            move = abs(candidate_start - old_time)

            if move > 2.25:
                continue
            if not (left <= candidate_start <= right):
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
                    None, expected, candidate_text
                ).ratio()

                candidate_set = set(candidate_tokens)
                anchor_score = (
                    sum(1 for t in strong_tokens if t in candidate_set)
                    / len(strong_tokens)
                    if strong_tokens else 0.0
                )

                timing_distance = abs(candidate_start - predicted_time)
                timing_score = max(0.0, 1.0 - timing_distance / 2.25)

                combined = (
                    text_score * 0.56
                    + anchor_score * 0.29
                    + timing_score * 0.15
                )

                if best is None or combined > best[0]:
                    best = (
                        combined,
                        text_score,
                        anchor_score,
                        candidate_start,
                        move,
                    )

        if best is None:
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "no-safe-candidate",
                "oldTime": round(old_time, 3),
            })
            continue

        combined, text_score, anchor_score, new_time, move = best
        old_error = abs(old_time - predicted_time)
        new_error = abs(new_time - predicted_time)
        improvement = old_error - new_error

        # Bigger movements require both neighboring anchors.
        anchor_requirement_ok = (
            move <= 1.25 or trusted_anchor_count >= 2
        )

        prev_ok = idx == 0 or new_time > float(working[idx - 1].time) + 0.20
        next_ok = (
            idx + 1 >= len(working)
            or new_time < float(working[idx + 1].time) - 0.20
        )

        should_apply = (
            combined >= 0.66
            and text_score >= 0.50
            and anchor_score >= 0.45
            and improvement >= 0.35
            and move <= 2.25
            and anchor_requirement_ok
            and prev_ok
            and next_ok
        )

        if not should_apply:
            details.append({
                "text": line.text,
                "changed": False,
                "reason": "candidate-rejected",
                "oldTime": round(old_time, 3),
                "candidateTime": round(new_time, 3),
                "moveSeconds": round(move, 3),
                "predictedTime": round(predicted_time, 3),
                "improvementSeconds": round(improvement, 3),
                "textScore": round(text_score, 4),
                "anchorScore": round(anchor_score, 4),
                "combinedScore": round(combined, 4),
                "trustedAnchors": trusted_anchor_count,
            })
            continue

        working[idx] = AlignedLine(
            time=round(new_time, 3),
            text=line.text,
        )
        recovered += 1

        details.append({
            "text": line.text,
            "changed": True,
            "oldTime": round(old_time, 3),
            "newTime": round(new_time, 3),
            "moveSeconds": round(move, 3),
            "lrclibTime": round(ref_time, 3),
            "predictedTime": round(predicted_time, 3),
            "improvementSeconds": round(improvement, 3),
            "textScore": round(text_score, 4),
            "anchorScore": round(anchor_score, 4),
            "combinedScore": round(combined, 4),
            "trustedAnchors": trusted_anchor_count,
        })

    monotonic = all(
        working[i].time < working[i + 1].time
        for i in range(len(working) - 1)
    )

    if not monotonic:
        return lines, {
            "enabled": True,
            "applied": False,
            "reason": "segment-recovery-broke-monotonicity",
            "attemptedCount": attempted,
            "recoveredCount": 0,
            "details": details,
        }

    return working, {
        "enabled": True,
        "applied": recovered > 0,
        "attemptedCount": attempted,
        "recoveredCount": recovered,
        "maxRecoveriesPerSong": MAX_RECOVERIES,
        "maxMoveSeconds": 2.25,
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
    V2.2 Robust QA Score.

    Le score ne doit plus être détruit par 1 seule ligne de bord,
    mais il reste strict :
    - couverture élevée
    - continuité finale
    - majorité des lignes proches de LRCLIB
    - médiane faible
    - pas de doublons suspects

    LRCLIB reste une validation croisée et non une vérité absolue.
    """
    coverage = float(base_diag.get("coverage") or 0)
    progression = float(base_diag.get("cursorProgression") or 0)
    anchor_quality = float(base_diag.get("anchorQuality") or 0)
    similarity = float(base_diag.get("averageSimilarity") or 0)

    continuity_scores = []
    for i in range(len(final_lines) - 1):
        dt = float(final_lines[i + 1].time) - float(final_lines[i].time)
        if dt <= 0:
            continuity_scores.append(0.0)
        elif dt < 0.35:
            continuity_scores.append(0.35)
        elif dt <= 20:
            continuity_scores.append(1.0)
        elif dt <= 35:
            continuity_scores.append(0.75)
        else:
            continuity_scores.append(0.40)

    continuity = (
        sum(continuity_scores) / len(continuity_scores)
        if continuity_scores else 1.0
    )

    within_025 = float(lrclib_delta.get("within025") or 0)
    within_050 = float(lrclib_delta.get("within050") or 0)
    within_075 = float(lrclib_delta.get("within075") or 0)
    within_100 = float(lrclib_delta.get("within100") or 0)
    comparison_coverage = float(
        lrclib_delta.get("comparisonCoverage") or 0
    )
    median_abs = float(
        lrclib_delta.get("medianAbsoluteDeltaSeconds") or 99
    )

    # Robust median quality: reaches 1.0 <= 0.25s, fades to 0 at 1.25s.
    median_quality = max(
        0.0,
        min(1.0, 1.0 - max(0.0, median_abs - 0.25) / 1.0),
    )

    # Temporal agreement focuses on the distribution, not the single worst outlier.
    temporal_agreement = (
        within_025 * 0.20
        + within_050 * 0.30
        + within_075 * 0.25
        + within_100 * 0.15
        + median_quality * 0.10
    )

    score = (
        coverage * 0.24
        + continuity * 0.18
        + progression * 0.10
        + anchor_quality * 0.08
        + similarity * 0.06
        + temporal_agreement * 0.26
        + comparison_coverage * 0.08
    )

    duplicate_penalty = 0.0
    if duplicates.get("suspect"):
        duplicate_penalty = min(
            0.10,
            0.025 * int(duplicates.get("count") or 0),
        )
        score -= duplicate_penalty

    score = max(0.0, min(1.0, score))

    details = {
        "version": "v2.2-robust",
        "coverage": round(coverage, 4),
        "finalTimingContinuity": round(continuity, 4),
        "cursorProgression": round(progression, 4),
        "anchorQuality": round(anchor_quality, 4),
        "textSimilarity": round(similarity, 4),
        "comparisonCoverage": round(comparison_coverage, 4),
        "within025": round(within_025, 4),
        "within050": round(within_050, 4),
        "within075": round(within_075, 4),
        "within100": round(within_100, 4),
        "medianAbsoluteDeltaSeconds": round(median_abs, 3),
        "medianQuality": round(median_quality, 4),
        "temporalAgreement": round(temporal_agreement, 4),
        "duplicatePenalty": round(duplicate_penalty, 4),
        "weights": {
            "coverage": 0.24,
            "finalTimingContinuity": 0.18,
            "cursorProgression": 0.10,
            "anchorQuality": 0.08,
            "textSimilarity": 0.06,
            "temporalAgreement": 0.26,
            "comparisonCoverage": 0.08,
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

    # 4) Edge Recovery V2.2 : lignes problématiques au début/à la fin
    edge_lines, edge_recovery = recover_edge_segments(
        words,
        intro_lines,
        lrclib_reference,
        lrclib_delta_after_intro,
    )

    lrclib_delta_after_edge = compare_with_lrclib(
        edge_lines,
        lrclib_reference,
    )

    # 5) Block Recovery V2.1 : petits groupes suspects entre deux ancres fiables
    block_lines, block_recovery = recover_suspect_blocks(
        words,
        edge_lines,
        lrclib_reference,
        lrclib_delta_after_edge,
    )

    lrclib_delta_after_block = compare_with_lrclib(
        block_lines,
        lrclib_reference,
    )

    # 6) Segment Recovery V2.0 conservé pour les lignes isolées restantes
    segment_lines, segment_recovery = recover_isolated_segments(
        words,
        block_lines,
        lrclib_reference,
        lrclib_delta_after_block,
    )

    lrclib_delta_after_segment = compare_with_lrclib(
        segment_lines,
        lrclib_reference,
    )

    # 7) correction locale sécurisée sur les gros écarts restants
    refined_lines, refinement = local_refine_lines(
        words,
        segment_lines,
        transcript,
        lrclib_reference,
        lrclib_delta_after_segment,
    )

    # 8) diagnostics finaux après éventuelles corrections
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
        and float(lrclib_delta.get("comparisonCoverage") or 0) >= 0.88
        and float(lrclib_delta.get("within075") or 0) >= 0.88
        and float(lrclib_delta.get("within100") or 0) >= 0.94
        and float(lrclib_delta.get("medianAbsoluteDeltaSeconds") or 99) <= 0.40
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
        "timingValidationVersion": "v2.2",
        "lrclibTimingScore": round(lrclib_score, 4),
        "lrclibDeltaBeforeRefinement": lrclib_delta_before,
        "lrclibDeltaAfterIntroRecovery": lrclib_delta_after_intro,
        "lrclibDeltaAfterEdgeRecovery": lrclib_delta_after_edge,
        "lrclibDeltaAfterBlockRecovery": lrclib_delta_after_block,
        "lrclibDeltaAfterSegmentRecovery": lrclib_delta_after_segment,
        "lrclibDelta": lrclib_delta,
        "introRecovery": intro_recovery,
        "edgeRecovery": edge_recovery,
        "blockRecovery": block_recovery,
        "segmentRecovery": segment_recovery,
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
        "version": "2.2",
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

