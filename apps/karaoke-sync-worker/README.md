# MixParty Karaoke Sync Worker V1.4.2 — requests fix

Correction de l'erreur Railway :

`ModuleNotFoundError: No module named 'requests'`

La dépendance `requests` est maintenant installée explicitement.

Aucun changement de contrat :
- `/health`
- `/align`
- `/align-upload`

Remplace le contenu de `apps/karaoke-sync-worker`, puis pousse sur GitHub.
