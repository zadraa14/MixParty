# MixParty Build 2.2 — HD Cover System

## Comportement

- Première lecture : le morceau reste sans jaquette HD afin que l’interface affiche le logo MixParty.
- Dès cette première lecture, PartyBrain lance une recherche de jaquette en arrière-plan.
- Deuxième ajout/lecture du même `videoId` : la jaquette HD mémorisée est jointe au morceau.
- Sans correspondance suffisamment fiable : le statut reste `not_found` et le logo MixParty reste affiché.

## Sources

1. Apple/iTunes Search API
2. MusicBrainz + Cover Art Archive
3. Aucun résultat fiable : logo MixParty côté interface

## Champs enregistrés

- `coverStatus`: `pending | found | not_found | error`
- `coverUrl`
- `coverSource`
- `coverWidth` / `coverHeight`
- `coverLastCheckedAt`
- `coverAttempts`

## Sécurité et performances

- La recherche est asynchrone et ne bloque jamais la lecture.
- Une seule recherche simultanée par morceau.
- MusicBrainz est interrogé en file séquentielle avec délai.
- Les résultats Apple sont validés par correspondance titre + artiste.
- Une absence de résultat n’est retentée qu’après 7 jours.

## Routes de contrôle

- `GET /partybrain/covers/status`
- `POST /partybrain/covers/:videoId/retry`

## Variable optionnelle Railway

- `ITUNES_STOREFRONT=FR`
- `MUSICBRAINZ_USER_AGENT=MixParty/1.0 (contact: votre-email)`
