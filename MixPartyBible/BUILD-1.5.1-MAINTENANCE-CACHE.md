# Build 1.5.1 — Maintenance du cache YouTube

Date : 01/08/2026

## Objectif

Permettre de vider les anciennes recherches YouTube depuis la page `/admin/musicbrain`, sans supprimer les connaissances de PartyBrain ni manipuler directement le volume Railway.

## Sécurité

La route de maintenance exige la variable Railway :

```env
PARTYBRAIN_ADMIN_TOKEN=un-code-secret-long
```

Le code est saisi dans l'interface au moment de l'action et n'est pas enregistré dans le navigateur.

## Action disponible

- Vider le cache YouTube (`youtube-search-cache.json`).
- Conserver `musicbrain.json`, les artistes, les morceaux, les scores, les votes et les statistiques.
- Demander une confirmation avant suppression.
- Afficher le nombre d'entrées supprimées.
