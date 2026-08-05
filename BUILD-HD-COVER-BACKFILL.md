# HD Cover Backfill

- Recherche automatiquement les jaquettes des anciens morceaux MusicBrain sans `coverStatus`.
- 2 recherches simultanées maximum par défaut.
- 50 morceaux maximum par cycle.
- 2 secondes entre deux morceaux par worker.
- Cycle automatique 8 secondes après le démarrage, puis toutes les 15 minutes tant qu’il reste des morceaux non traités.
- Route manuelle : `POST /partybrain/covers/backfill`.
- Les statistiques `/musicbrain/stats` exposent `covers` et `coverBackfill`.

Variables optionnelles :
- `PARTYBRAIN_COVER_BACKFILL_BATCH_SIZE=50`
- `PARTYBRAIN_COVER_BACKFILL_CONCURRENCY=2`
- `PARTYBRAIN_COVER_BACKFILL_DELAY_MS=2000`
