# MixParty V2 — Phase 1 : stabilisation

Cette version commence la migration vers une architecture plus fiable sans retirer les fonctions existantes.

## Corrections incluses

- normalisation automatique des anciennes soirées enregistrées dans `data.json` ;
- ajout automatique des tableaux manquants : `songs`, `history`, `participants` ;
- migration des anciens participants enregistrés comme simples chaînes de caractères ;
- protection du frontend contre une réponse API incomplète ;
- correction définitive de `party.songs is not iterable` ;
- conservation des MixMates, du DJ, des suggestions, des votes, de Socket.IO et de la lecture automatique ;
- lancement API Windows robuste avec `--respawn --transpile-only`.

## Installation

Conserver votre fichier `apps/api/.env`, puis lancer à la racine :

```powershell
npm install
npm run dev
```

Les anciennes soirées sont réparées automatiquement au chargement de l’API.
