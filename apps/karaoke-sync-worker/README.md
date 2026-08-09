# MixParty Karaoke Sync Worker V1.4.1 — API Compatible

Correction du HTTP 422 observé après le passage à faster-whisper.

## Cause
L'API MixParty actuelle envoyait :
- `payload` : JSON contenant notamment `lyrics.plainLyrics` / `lyrics.syncedLyrics`
- `audio` : MP3

La V1.4 attendait :
- `transcript`
- `audio`

FastAPI rejetait donc la requête avec `422 Unprocessable Entity`.

## Correction
`/align-upload` et `/align` acceptent maintenant les deux contrats :
- `payload + audio` (MixParty actuel)
- `transcript + audio` (debug/direct)

Aucune modification de l'API MixParty ou de MusicBrain n'est nécessaire.
