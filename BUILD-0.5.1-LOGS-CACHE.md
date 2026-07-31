# Build 0.5.1 — Diagnostic du cache de recherche

La console API affiche maintenant, pour chaque recherche :

- la recherche saisie ;
- la clé normalisée ;
- la source (`YouTube API`, cache exact, cache avec faute corrigée, variante ou requête déjà en cours) ;
- le temps de réponse ;
- le nombre de résultats ;
- le nombre d’entrées en cache ;
- le nombre d’appels YouTube ;
- le nombre de requêtes YouTube économisées.

## Test conseillé

1. Rechercher `Daft Punk` une première fois : la source doit être `YouTube API`.
2. Rechercher `Daft Punk` une seconde fois : la source doit être `Cache exact`.
3. Rechercher `daft-punk` ou `DAFT PUNK` : la recherche doit être servie depuis le cache.
