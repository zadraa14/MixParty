# Build 1.4 — PartyBrain Academy V1

Build complet basé sur MixParty 1.3.

## Variables Railway

```env
PARTYBRAIN_ACADEMY_ENABLED=true
PARTYBRAIN_QUOTA_DAILY_LIMIT=100
PARTYBRAIN_ACADEMY_MINUTES_BEFORE_RESET=15
PARTYBRAIN_QUOTA_TIMEZONE=America/Los_Angeles
PARTYBRAIN_ACADEMY_TARGET_SONGS=24
PERSISTENT_DATA_DIR=/data
```

`PARTYBRAIN_QUOTA_RESERVE` n'est plus utilisé par ce build.

## Endpoints

- `GET /partybrain/academy`
- `GET /musicbrain/stats` inclut désormais la section `academy`
- `POST /partybrain/academy/run` disponible uniquement avec `PARTYBRAIN_ACADEMY_ALLOW_MANUAL=true`

## Fichiers persistants

- `/data/partybrain-academy.json`
- `/data/musicbrain.json`
- `/data/youtube-search-cache.json`
- `/data/data.json`
