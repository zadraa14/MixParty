# MixParty Build 1.6 — PartyBrain Recommendation Score V1

PartyBrain possède maintenant un score de recommandation explicable sur 100.

## Signaux positifs

- transition directe après le morceau actuel : 28 points ;
- affinité avec les artistes récents : 18 points ;
- popularité MixParty : 15 points ;
- taux de lecture terminée : 14 points ;
- votes reçus : 10 points ;
- compatibilité avec l’heure actuelle : 7 points ;
- fraîcheur et qualité des métadonnées : 8 points.

## Pénalités

- morceaux souvent passés ;
- morceaux souvent supprimés ;
- répétition trop rapide du même artiste ;
- durée anormale ;
- métadonnées trop peu fiables.

## API

`GET /party/:code/partybrain/recommendations?limit=10`

La réponse contient :

- le score final ;
- le niveau de confiance ;
- le détail de chaque composante ;
- les raisons lisibles ;
- le volume de preuves utilisé.

Les morceaux déjà joués, actuellement en lecture ou déjà présents dans la file sont exclus.
