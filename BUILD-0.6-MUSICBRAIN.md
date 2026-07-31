# Build 0.6 — MusicBrain V1

## Inclus

- Base locale persistante `apps/api/musicbrain.json`.
- Enregistrement automatique des artistes et morceaux découverts.
- Statistiques de recherches, ajouts, lectures et votes.
- Apprentissage des enchaînements entre deux morceaux.
- API de consultation :
  - `GET /musicbrain/stats`
  - `GET /musicbrain/artists/:key`
- Tableau de bord : `/admin/musicbrain`.
- Architecture sans nouvelle dépendance, prête à être remplacée plus tard par PostgreSQL.

## Test local

```powershell
cd C:\Dev\MixParty06
npm install
npm run dev
```

Puis ouvrir :

```text
http://localhost:3000/admin/musicbrain
```

La base se remplit quand des morceaux sont recherchés, ajoutés, votés ou joués.

## Important pour Railway

Le fichier JSON est persistant sur le PC, mais le système de fichiers d'un déploiement Railway peut être remplacé lors d'un nouveau déploiement. Cette version sert à valider MusicBrain. Pour une conservation fiable en production, la prochaine étape sera PostgreSQL ou un volume persistant Railway.
