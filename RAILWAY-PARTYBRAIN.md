# Déployer PartyBrain sur Railway

PartyBrain utilise un fichier JSON, mais il devient persistant sur Railway grâce à un **Volume**.

## API Railway

1. Ouvrir le service API (`disciplined-unity`).
2. Aller dans **Volumes** puis **Add Volume**.
3. Monter le volume sur :

```text
/data
```

4. Dans **Variables**, ajouter :

```text
PERSISTENT_DATA_DIR=/data
```

5. Redéployer le dernier commit.

PartyBrain conservera alors :

- `/data/musicbrain.json`
- `/data/youtube-search-cache.json`
- `/data/data.json`

La page d'administration indiquera « Stockage persistant Railway actif ».

## Accès admin

```text
https://VOTRE-FRONTEND.up.railway.app/admin/musicbrain
```
