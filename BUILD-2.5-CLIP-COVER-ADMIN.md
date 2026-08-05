# MixParty Build 2.5 — Clip DJ, jaquettes vérifiées et suivi admin

## Bouton DJ « Afficher le clip »

- désactivé par défaut ;
- réservé au créateur de la soirée ;
- mémorisé dans la soirée avec `showVideoClip` ;
- l’iframe YouTube reste montée : aucun redémarrage ni interruption lors du changement ;
- jaquette/logo visibles quand le clip est masqué ;
- vidéo visible dans la console DJ quand le clip est activé.

## Jaquettes

Ordre de recherche :

1. Apple/iTunes avec correspondance artiste + titre renforcée ;
2. MusicBrainz + Cover Art Archive ;
3. pochette d’un album fiable du même artiste (`APPLE_ARTIST_FALLBACK`) ;
4. logo MixParty si aucun résultat fiable.

## Administration PartyBrain

La page affiche désormais :

- téléchargées ;
- en attente ;
- téléchargements actifs ;
- exactes ;
- secours artiste ;
- introuvables ;
- erreurs ;
- non recherchées.

## Vérifications

- build TypeScript API validé ;
- vérification TypeScript web validée.
