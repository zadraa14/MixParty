# MixParty Karaoke Sync Worker V2.0 — Segment Recovery

V2.0 généralise les corrections sans créer de règle par chanson.

Pipeline:
1. Faster-Whisper
2. Intro Recovery V1.9
3. Segment Recovery V2.0
4. Local Refinement sécurisé
5. Recalcul complet du score
6. Publication seulement si confiance >= 92 %

Segment Recovery:
- cible les lignes isolées avec un écart >= 0,75 s
- utilise les lignes voisines fiables comme ancres
- recherche uniquement dans une petite fenêtre audio
- maximum 2,25 s de déplacement
- les déplacements > 1,25 s exigent deux ancres fiables
- preuve lexicale obligatoire
- amélioration minimale 0,35 s
- maximum 4 corrections par morceau
- refuse toute correction qui casserait l'ordre des timestamps

Aucune règle spécifique à GIMS, ABCD ou à un autre morceau.
Shadow Mode et seuil 92 % conservés.
