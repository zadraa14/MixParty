# MixParty Karaoke Sync Worker V1.7 — Local Refinement

Objectif : corriger seulement les quelques lignes qui dérapent fortement,
sans tricher sur le score global.

## Nouveau comportement

Pour une ligne avec un delta LRCLIB > 0,75 s :

1. le moteur calcule un offset global robuste à partir des lignes déjà bonnes ;
2. il prédit une petite zone temporelle attendue ;
3. il rescane uniquement les mots Faster-Whisper dans cette zone ;
4. il remplace le timestamp seulement si :
   - le matching texte / mots-ancres est crédible ;
   - la cohérence temporelle gagne au moins 0,30 s ;
   - l'ordre global des lignes reste strictement croissant.

## Doublons

Un refrain répété n'est plus pénalisé.

Une répétition est dite suspecte seulement si la même ligne normalisée apparaît
deux fois à moins de 2,25 secondes.

## Sécurité

- seuil toujours à 92 %
- Shadow Mode inchangé
- LRCLIB reste une référence comparative, pas une vérité absolue
- si la correction locale casse l'ordre des timestamps, elle est annulée
