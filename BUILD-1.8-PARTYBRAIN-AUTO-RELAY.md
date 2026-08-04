# MixParty Build 1.8 — PartyBrain Auto Relay

## Fonctionnement

La route existante `POST /party/:code/next` conserve son fonctionnement actuel :

1. elle cherche d'abord le prochain morceau dans la file des utilisateurs ;
2. si la file contient un morceau, rien ne change ;
3. uniquement si la file est vide, PartyBrain calcule la meilleure recommandation ;
4. la recommandation est acceptée seulement si elle dépasse les seuils de sécurité ;
5. PartyBrain ajoute alors le morceau à la soirée et le lance ;
6. l'ajout et le démarrage sont enregistrés dans PartyBrain Intelligence.

## Seuils par défaut

- score minimum : 55
- confiance minimum : 30

Variables Railway optionnelles :

- `PARTYBRAIN_RELAY_MIN_SCORE`
- `PARTYBRAIN_RELAY_MIN_CONFIDENCE`

## Priorité

Les morceaux ajoutés par les utilisateurs restent toujours prioritaires.

## Réponse API

La réponse de `/next` contient maintenant :

```json
{
  "partyBrain": {
    "relayUsed": true,
    "source": "partybrain_suggestion"
  }
}
```

Si PartyBrain ne trouve rien d'assez fiable, l'ancien message
`Plus de chansons disponibles` est conservé avec un diagnostic supplémentaire.
