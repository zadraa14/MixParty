# MixParty Build 2.0 — Secours PartyBrain

## Hiérarchie du relais

Lorsque la file est vide et que le relais est activé :

1. PartyBrain essaie la recommandation normale avec le score et la confiance.
2. Si elle n'atteint pas les seuils, il cherche un morceau de secours prudent.
3. Si aucun morceau sûr n'est disponible, l'ancien message `Plus de chansons disponibles` est conservé.

## Sélection du secours

Le secours exclut :

- les morceaux déjà joués ;
- le morceau en cours ;
- les morceaux déjà présents dans la file ;
- les morceaux trop courts ou trop longs ;
- les métadonnées très peu fiables ;
- les morceaux souvent passés ou supprimés ;
- les répétitions trop rapprochées du même artiste.

Il privilégie :

- les morceaux souvent ajoutés ;
- les morceaux souvent joués ;
- les morceaux ayant reçu des votes ;
- les lectures terminées ;
- les métadonnées fiables.

## Variable Railway

`PARTYBRAIN_RELAY_FALLBACK_ENABLED=true`

Mettre `false` pour désactiver totalement le secours.

## Identification

Un morceau de secours apparaît comme ajouté par `PartyBrain Secours`.

La réponse de `/next` utilise :

`partyBrain.source = "partybrain_safe_fallback"`
