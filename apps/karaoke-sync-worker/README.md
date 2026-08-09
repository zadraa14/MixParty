# MixParty Karaoke Sync Worker V1.3 Low-Memory

Cette version corrige le crash Railway `Killed` observé pendant le premier vrai test.

Optimisations :
- Whisper `base`
- CPU / int8
- batch size 1
- un seul thread
- conversion préalable en mono 16 kHz
- fenêtre d'alignement légèrement réduite
- libération explicite de la mémoire après chaque morceau

Les endpoints restent identiques :
- `/health`
- `/align`
- `/align-upload`

Aucune modification de l'API MixParty ou de la page MusicBrain n'est nécessaire.
