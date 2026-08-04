# MixParty Build 1.7 — Best Recommendation API

## Objectif

Ajouter une route API qui retourne uniquement le meilleur morceau PartyBrain pour une soirée, sans modifier le comportement actuel de MixParty.

## Nouvelle route

`GET /party/:code/partybrain/best-recommendation`

Paramètres optionnels :

- `minimumScore`
- `minimumConfidence`

Exemple :

`GET /party/ABCD/partybrain/best-recommendation?minimumScore=60&minimumConfidence=40`

## Garanties

Cette route est en lecture seule :

- elle n'ajoute aucun morceau ;
- elle ne lance aucune musique ;
- elle ne modifie pas la file ;
- elle ne modifie pas l'historique ;
- elle ne change pas le morceau en cours ;
- elle réutilise exactement le moteur de score PartyBrain V1.

## Réponse

La réponse contient :

- `accepted`
- les seuils demandés
- le morceau courant
- la longueur de la file
- la meilleure recommandation
- le score
- la confiance
- le détail du score
- les raisons
- les preuves utilisées
