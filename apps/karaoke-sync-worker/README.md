# MixParty Karaoke Sync Worker V1.4

Remplacement du worker WhisperX/Pyannote par `faster-whisper`.

## Pourquoi
Le worker Railway était tué pendant le chargement de WhisperX/Pyannote (`Killed`).
Cette version supprime complètement Pyannote et WhisperX du runtime.

## Pipeline
1. FFmpeg -> mono PCM 16 kHz
2. faster-whisper CPU/int8
3. timestamps mot par mot
4. alignement monotone avec les lignes LRCLIB
5. score de confiance
6. `publishable=true` uniquement si :
   - confiance >= 92 %
   - couverture >= 90 %
   - timestamps strictement croissants

## Endpoints
- `GET /`
- `GET /health`
- `POST /align`
- `POST /align-upload`

`/align` et `/align-upload` acceptent :
- `audio` : fichier multipart
- `transcript` : texte LRCLIB multipart

## Railway
Root Directory :
`/apps/karaoke-sync-worker`

Port :
`8080`

Les variables actuelles de MixParty peuvent rester identiques.
