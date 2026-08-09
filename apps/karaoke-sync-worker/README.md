# MixParty Karaoke Sync Worker V1

Worker HTTP séparé du backend principal. Il reçoit les paroles LRCLIB et **l'audio exact réellement utilisé**, puis utilise WhisperX pour produire de nouveaux timestamps calculés sur cet audio.

## Endpoint

- `GET /health`
- `POST /align`

Le backend MixParty V1 Shadow attend déjà ce contrat.

## Important

Le worker ne télécharge pas lui-même l'audio YouTube. `audioUrl` doit pointer vers une source audio que MixParty est autorisé à traiter. C'est volontaire : un simple `videoId` ne donne pas au worker les octets audio nécessaires à un alignement fiable.

## Déploiement

Une machine GPU est fortement recommandée. Le projet Nightingale documente environ 2–5 min par chanson sur GPU contre 10–20 min sur CPU pour son pipeline d'analyse comparable.

Une fois le worker publié :

```text
KARAOKE_SYNC_ENGINE_URL=https://TON-WORKER/align
KARAOKE_SYNC_ENGINE_TOKEN=le-meme-token
```

à ajouter au backend MixParty.

## Étape suivante

Brancher un fournisseur d'audio autorisé dans `apps/api/src/index.ts` afin que le backend ajoute `audioUrl` au JSON envoyé au worker. Tant que cette URL n'existe pas, le worker répond `needs_review` au lieu de certifier à tort.
