# Build 1.0 — Music Intelligence Core

## Objectif

Fiabiliser les données apprises par PartyBrain avant le déploiement de la V1.0 sur Railway.

## Changements

- Nouveau module `apps/api/src/music-intelligence/`.
- Nettoyage centralisé des titres et noms d’artistes.
- Décodage des entités HTML.
- Détection des collaborations `feat.`, `ft.`, `avec`, `x`, `×` et `&`.
- Conservation du duo `Bigflo & Oli` comme artiste principal.
- Filtrage des faux artistes et sources : radios, labels, `Exclu`, `Official`, `Topic`, `Lyrics`, `Clip`, `HD`, `4K`, etc.
- Priorité aux métadonnées des Art Tracks « Provided to YouTube by ».
- Utilisation du titre, de la chaîne et de la requête comme solutions de repli ordonnées.
- Migration automatique de la base PartyBrain existante au démarrage.
- Compatibilité conservée avec `PERSISTENT_DATA_DIR=/data` sur Railway.

## Exemples attendus

- `GIMS x La Mano 1.9 - PARISIENNE (Clip Officiel)`
  - artiste principal : `GIMS`
  - collaborateur : `La Mano 1.9`
  - titre : `PARISIENNE`
- `GIMS (ft. Mauvais Djo) - VIVE LA MONNAIE`
  - artiste principal : `GIMS`
  - collaborateur : `Mauvais Djo`
  - titre : `VIVE LA MONNAIE`
- `SkyrockFM - EXCLU PARISIENNE`
  - `SkyrockFM` n’est jamais enregistré comme artiste.
