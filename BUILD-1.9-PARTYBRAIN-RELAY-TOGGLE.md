# MixParty Build 1.9 — Bouton relais PartyBrain

## Interface DJ

Un bouton compact a été ajouté dans l'onglet Lecture :

- désactivé par défaut ;
- gris/cyan lorsqu'il est désactivé ;
- vert lorsqu'il est activé ;
- réservé à l'appareil du créateur ;
- synchronisé en temps réel avec tous les appareils.

## API

Nouvelle route :

`POST /party/:code/partybrain/auto-relay`

Corps :

```json
{
  "enabled": true,
  "creatorToken": "...",
  "actor": "..."
}
```

## Sécurité

Le token du créateur est obligatoire. Le relais automatique ne peut plus se déclencher
si `partyBrainAutoRelayEnabled` est désactivé.

## Compatibilité

- la file utilisateur reste prioritaire ;
- le relais est désactivé par défaut pour les nouvelles et anciennes soirées ;
- le fonctionnement normal de `/next` reste inchangé lorsque la file contient des titres.
