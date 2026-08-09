# MixParty Karaoke Sync Worker V1.8 — Safe Refinement

V1.8 rend la correction locale beaucoup plus stricte.

## Sécurité
- aucun déplacement supérieur à 2,0 secondes
- cohérence obligatoire avec la ligne précédente et suivante
- amélioration minimale de 0,25 seconde
- matching lexical minimum
- si l'ordre des timestamps casse, toutes les corrections locales sont annulées

## Confiance
La confiance est maintenant recalculée APRÈS les corrections.

Le score final combine :
- couverture
- continuité temporelle finale
- progression
- mots-ancres
- similarité textuelle
- validation croisée LRCLIB

Le seuil reste 92 % et le Shadow Mode reste actif.
