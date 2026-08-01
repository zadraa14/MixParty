# Build 1.5 — Smart Search Engine

## Objectif

Ne plus limiter une recherche d'artiste à huit morceaux et utiliser PartyBrain avant YouTube.

## Fonctionnement

- YouTube retourne jusqu'à 50 candidats par recherche.
- MixParty filtre les contenus non musicaux et classe les Art Tracks, audios et clips officiels en priorité.
- Les doublons exacts (`videoId`) et les doublons de morceau sont fusionnés.
- Jusqu'à 40 morceaux propres peuvent être affichés.
- Si PartyBrain connaît déjà au moins 20 morceaux correspondant à la recherche, aucun appel YouTube n'est effectué.
- Si la première recherche reste trop pauvre, une seule recherche complémentaire ciblée `official audio topic` est lancée.
- Le cache est conservé 30 jours et peut contenir 2 000 recherches.

## Résultat attendu

Une recherche comme `PLK` doit proposer nettement plus de titres, sans obliger l'utilisateur à saisir chaque nom de morceau, tout en limitant les appels de quota.
