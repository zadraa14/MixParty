# MixParty Karaoke Sync Worker V2.1 — Block Recovery

V2.1 ajoute un recalage générique par petits blocs, sans règle par chanson.

Pipeline:
1. Faster-Whisper
2. Intro Recovery
3. Block Recovery V2.1
4. Segment Recovery V2.0 (fallback pour lignes isolées)
5. Local Refinement sécurisé
6. Recalcul complet du score
7. Publication seulement si confiance >= 92 %

Block Recovery V2.1:
- détecte automatiquement 2 à 4 lignes consécutives avec écart >= 0,75 s
- exige deux ancres voisines fiables (<= 0,50 s)
- interpole l'offset local entre les deux ancres
- recherche chaque ligne dans une fenêtre audio bornée
- valide lexicalement chaque candidat
- applique le bloc uniquement si toutes les lignes restent monotones et sûres
- refuse le bloc entier si une ligne n'a pas de preuve suffisante

Aucune règle spécifique à GIMS, ABCD ou un autre morceau.
Shadow Mode et seuil 92 % conservés.
