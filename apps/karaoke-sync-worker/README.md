# MixParty Karaoke Sync Worker V1.6 — LRCLIB Delta Validation

Cette version ajoute une vraie validation temporelle croisée.

Pour chaque ligne alignée par Faster-Whisper :
- timestamp LRCLIB d'origine
- timestamp recalculé
- delta signé
- delta absolu
- qualité du matching texte

Diagnostics agrégés :
- médiane absolue
- moyenne absolue
- biais médian (avance/retard)
- % de lignes à ±0,25 s
- % à ±0,50 s
- % à ±0,75 s
- % à ±1,00 s
- détection de doublons temporels suspects

Important :
LRCLIB n'est pas traité comme une vérité absolue.
Le score principal reste basé sur Faster-Whisper + cohérence temporelle.
LRCLIB sert de validation croisée et de diagnostic.

Le seuil de certification reste à 92 %.
