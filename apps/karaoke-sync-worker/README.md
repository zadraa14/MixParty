# MixParty Karaoke Sync Worker V1.5 — Timing Confidence

Cette version garde faster-whisper mais change le score de certification.

## Pourquoi
ABCD avait :
- couverture : 93,6 %
- timestamps croissants
- 29 / 31 lignes alignées
- similarité moyenne : 74,4 %
- score final : 88,8 %

La V1.4 donnait encore trop de poids à la transcription textuelle brute.

## Nouveau score
Le V1.5 privilégie la qualité temporelle :

- 42 % couverture des lignes
- 20 % continuité temporelle
- 14 % progression monotone dans les mots
- 14 % qualité des mots-ancres
- 10 % similarité textuelle brute

## Certification
Le seuil reste volontairement strict :
- confiance >= 92 %
- couverture >= 90 %
- continuité temporelle >= 90 %
- progression >= 85 %
- timestamps strictement croissants

Aucun morceau n'est publié automatiquement : le Shadow Mode de MixParty reste inchangé.
