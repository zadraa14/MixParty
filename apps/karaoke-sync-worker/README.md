# MixParty Karaoke Sync Worker V1.1 — Railway Light

Cette variante vise à réduire fortement l'image Docker Railway.

## Pourquoi la V1 était lourde

`pip install whisperx` peut résoudre la pile PyTorch Linux avec des dépendances
CUDA/NVIDIA très volumineuses. La V1.1 installe explicitement les wheels
**CPU-only** de PyTorch avant WhisperX.

## Fichiers à remplacer

Remplace entièrement le contenu de :

`apps/karaoke-sync-worker`

par les fichiers de ce dossier, puis :

```powershell
cd C:\Dev\MixParty
git add apps/karaoke-sync-worker
git commit -m "fix: lighten karaoke sync worker for Railway"
git push
```

Railway garde le Root Directory :

`/apps/karaoke-sync-worker`

## Variables

Aucune variable n'est obligatoire pour le simple démarrage.

Valeurs conseillées :
- `WHISPER_MODEL=small`
- `WHISPER_DEVICE=cpu`
- `WHISPER_COMPUTE_TYPE=int8`
- `KARAOKE_MIN_CONFIDENCE=92`

Le modèle Whisper n'est pas embarqué dans l'image Docker : il sera récupéré
au premier véritable traitement si nécessaire.
