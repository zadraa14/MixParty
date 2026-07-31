# Build 0.8 — PartyBrain V2

## Nouveautés

- Artist Cleaner : fusion des variantes et des featuring sous l’artiste principal.
- Nettoyage des titres : décodage HTML et retrait des mentions visuelles inutiles.
- Détection des collaborateurs et création de relations entre artistes.
- Migration automatique de l’ancienne base PartyBrain au démarrage.
- Nouveau point d’API `/partybrain/graph`.
- Nouvelle page `/admin/partybrain/graph` avec constellation interactive.
- Bouton « Explorer le cerveau » sur le tableau de bord PartyBrain.

## Stockage

La base reste compatible avec le volume Railway configuré via :

```env
PERSISTENT_DATA_DIR=/data
```

La migration s’effectue lors du premier démarrage du Build 0.8 et conserve les statistiques existantes.
