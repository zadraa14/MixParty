# MixParty Build 2.1 — PartyBrain Cold Start + Diversité

## Objectif

Éviter que PartyBrain choisisse toujours le même morceau lorsque la base d’apprentissage contient encore peu de soirées.

## Modifications

- prise en compte du style probable du morceau précédent ;
- bonus pour les styles identiques ou compatibles ;
- pénalité pour les ruptures de style peu cohérentes ;
- analyse des cinq meilleures recommandations au lieu de prendre systématiquement la première ;
- rotation déterministe parmi les meilleurs candidats ;
- pénalité forte pour les titres récemment choisis par PartyBrain ;
- pénalité progressive pour les titres trop souvent choisis par le relais ;
- secours PartyBrain lui aussi rendu contextuel et diversifié.

## Priorité conservée

1. transition directe déjà apprise ;
2. relation entre artistes ;
3. compatibilité de style en phase de cold start ;
4. qualité, votes et historique ;
5. popularité générale en dernier recours.

## Sécurité

- la file ajoutée par les utilisateurs reste prioritaire ;
- le bouton d’activation DJ reste obligatoire ;
- le système de secours reste actif ;
- aucune modification du lecteur YouTube ;
- aucune modification de l’interface.

## Vérification

La syntaxe TypeScript du fichier API a été validée avec le compilateur TypeScript inclus dans le projet.
