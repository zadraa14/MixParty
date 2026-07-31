# Build 0.5 — Recherche musicale V2

## Fonctionnement

- Une recherche exacte déjà effectuée est servie depuis le cache pendant 24 heures.
- Les variantes proches (`Big Flo & Oli`, `bigflo et oli`, `big flo oli`) partagent le même cache.
- Une petite faute d’orthographe peut réutiliser une recherche déjà connue.
- Les appels identiques lancés au même moment sont regroupés en un seul appel YouTube.
- Les résultats sont limités à la catégorie Musique et classés selon leur pertinence musicale.

## Limite actuelle

Le cache est stocké dans le conteneur de l’API et dans un fichier local ignoré par Git. Il survit aux recherches normales, mais peut être effacé lors d’un redéploiement Railway. Une base Redis ou PostgreSQL pourra rendre ce cache permanent plus tard.

## Test conseillé

1. Rechercher `Bigflo et Oli`.
2. Rechercher une seconde fois `BIG FLO & OLI` : le résultat doit revenir sans consommer une nouvelle recherche YouTube.
3. Rechercher `bigflo olii` : si la première recherche est encore en cache, la variante doit être reconnue.
4. Vérifier que les résultats affichent principalement des clips ou audios musicaux officiels.
