# MixParty Build 1.5 — PartyBrain Event Collection Complete

## Collecte V1 terminée

Événements couverts :

- PARTY_CREATED
- PARTICIPANT_JOINED
- PARTICIPANT_LEFT
- SONG_SEARCHED
- SONG_ADDED
- SONG_VOTED
- SONG_DOWNVOTED
- SONG_PLAY_STARTED
- SONG_PROGRESS
- SONG_PLAY_COMPLETED
- SONG_SKIPPED
- SONG_REMOVED
- QUEUE_REORDERED
- PARTY_ENDED

## Nouvelles routes

- `POST /party/:code/song/:index/downvote`
- `DELETE /party/:code/song/:index`
- `POST /party/:code/reorder`
- `POST /party/:code/end`
- `GET /partybrain/intelligence/events/coverage`

## Correctifs

- La route `presence` enregistre maintenant l’arrivée d’un nouvel utilisateur.
- Les utilisateurs expirés après 30 secondes produisent un événement `PARTICIPANT_LEFT`.
- Les soirées expirées après 24 heures produisent un événement `PARTY_ENDED`.
- La lecture manuelle marque correctement le morceau comme joué.
- La fin explicite d’une soirée exige le token du créateur.
