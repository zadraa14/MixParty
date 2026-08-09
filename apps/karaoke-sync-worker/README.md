# MixParty Karaoke Sync Worker V2.2 — Edge Recovery + Robust QA

Construit directement depuis la V2.1 réellement testée.

## Edge Recovery
Traite automatiquement les 3 premières / 3 dernières lignes quand elles sont
décalées et qu'une ancre fiable existe vers l'intérieur du morceau.

Garde-fous :
- delta >= 0,75 s uniquement
- déplacement max 2,25 s
- preuve lexicale obligatoire
- amélioration >= 0,35 s
- ordre temporel strict conservé

## Robust QA Score
Le score final n'est plus détruit par un seul outlier de bord.
Il juge la distribution globale :
- couverture
- continuité
- progression
- ancres lexicales
- similarité
- % de lignes à ±0,25 / ±0,50 / ±0,75 / ±1,00 s
- delta médian

## Validation finale
Le score >= 92 % ne suffit PAS à lui seul.
Le morceau doit aussi satisfaire :
- couverture >= 90 %
- comparaison LRCLIB >= 88 %
- >= 88 % des lignes à ±0,75 s
- >= 94 % à ±1,00 s
- delta médian <= 0,40 s
- aucun doublon suspect
- timestamps croissants

Shadow Mode conservé.
