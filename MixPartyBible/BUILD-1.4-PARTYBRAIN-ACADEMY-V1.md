# 🧠 BUILD 1.4 — PartyBrain Academy V1

Date : 01/08/2026

## Objectif

Permettre à PartyBrain d'utiliser automatiquement le quota YouTube restant juste avant sa remise à zéro, afin d'enrichir sa base musicale pendant les périodes d'inactivité.

## Déclenchement

Academy ne démarre jamais à minuit en France.

Elle calcule la prochaine remise à zéro à partir du fuseau officiel du quota :

```env
PARTYBRAIN_QUOTA_TIMEZONE=America/Los_Angeles
```

En heure d'été française, la remise à zéro apparaît généralement vers 09:00. L'heure affichée est calculée automatiquement et suit les changements d'heure.

Academy démarre dans la fenêtre configurée :

```env
PARTYBRAIN_ACADEMY_MINUTES_BEFORE_RESET=15
```

## Utilisation du quota

Academy utilise tout le quota estimé restant dans cette fenêtre. L'ancienne réserve de 20 recherches n'est plus utilisée.

Le compteur est conservé dans le volume Railway :

```text
/data/partybrain-academy.json
```

Le compteur est une estimation basée sur les appels réellement effectués par MixParty. Si Google signale une erreur 429, Academy s'arrête immédiatement.

## Choix des missions

PartyBrain ne recherche pas des artistes au hasard. Il privilégie :

1. les artistes réellement recherchés par les utilisateurs ;
2. les artistes connus avec trop peu de morceaux ;
3. les artistes vus récemment ;
4. les requêtes complémentaires encore jamais tentées.

Exemples de variantes :

- `Artiste official audio`
- `Artiste topic`
- `Artiste chansons`
- `Artiste album`
- `Artiste art track`
- `Artiste meilleurs titres`

## Journal permanent

Chaque session conserve :

- l'heure de début et de fin ;
- le nombre de recherches prévues et utilisées ;
- les artistes enrichis ;
- les nouveaux morceaux ajoutés ;
- les erreurs éventuelles ;
- la raison de l'arrêt.

## Tableau de bord

La page `/admin/musicbrain` affiche maintenant :

- quota estimé restant ;
- heure de la prochaine remise à zéro ;
- temps restant ;
- état de la fenêtre Academy ;
- progression d'une session en cours ;
- dernière session terminée ;
- prochaines missions ;
- journal détaillé.

## Sécurité

- une seule session automatique par cycle de quota ;
- une recherche à la fois ;
- arrêt 20 secondes avant la remise à zéro ;
- arrêt immédiat en cas d'erreur 429 ;
- état et rapports persistants dans le volume Railway.

## Philosophie

> Transformer le quota inutilisé en connaissances utiles, sans perturber les recherches des utilisateurs.
