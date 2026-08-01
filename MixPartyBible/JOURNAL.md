# Journal MixParty

## 31 juillet 2026

- Reprise du projet à partir de l’archive `MixParty-MixMates-officiel`.
- Décision confirmée : mise en suspens des MixMates.
- Nettoyage du frontend, de l’API, des styles, des données et des images MixMates.
- Remplacement des avatars MixMates des participants par une pastille avec leur initiale.
- Création du dossier `MixPartyBible`.
- Prochaine étape : poursuivre le design de la V1.

---

## 31 juillet 2026 — Correction des boutons lumineux

- Correction de l’animation lumineuse des boutons **Titre suivant**, **Lancer le DJ** et **Rechercher**.
- Le reflet animé est désormais masqué à l’intérieur des bords arrondis grâce à `overflow: hidden`.
- L’apparence et le halo externe des boutons sont conservés.

---

## 31 juillet 2026 — Robustesse des données de soirée

- Correction d’un crash lorsque l’API renvoyait une soirée sans tableau `songs`.
- Normalisation des données `songs`, `history` et `participants`.
- La file d’attente DJ reste fonctionnelle même avec des données incomplètes.

---

## 31 juillet 2026 — Compatibilité téléphone

- QR Code compatible avec le réseau local.
- Détection automatique de l'adresse IPv4 du PC.
- Serveur accessible sur toutes les interfaces.
- Proxy `/mixparty-api`.
- Gestion des erreurs réseau.
- Compatibilité améliorée avec iPhone.

---

## 31 juillet 2026 — Sprint Expérience Soirée V1.1

- Présence temps réel des participants.
- Profils avec photo ou avatar MixParty.
- Nouveau lecteur orienté musique.
- Navigation mobile repensée.
- Visualiseur musical.
- Synchronisation Socket.IO améliorée.

---

## 31 juillet 2026 — Déploiement officiel de MixParty 🚀

### Infrastructure

- Déploiement du frontend sur Railway.
- Déploiement de l'API sur Railway.
- Configuration des variables d'environnement.
- Application accessible publiquement.

### Corrections

- Correction du port Railway.
- Correction du fichier `data.json`.
- Connexion Frontend ↔ API.
- Configuration Socket.IO en production.

### Recherche musicale

- Ajout de la clé YouTube sur Railway.
- Recherche musicale opérationnelle.

### Résultat

- ✅ Création de soirée.
- ✅ Rejoindre une soirée.
- ✅ Synchronisation temps réel.
- ✅ Recherche YouTube.
- ✅ Première version publique disponible.

---

## 31 juillet 2026 — Début de la V2

Après validation de la V1, début de la refonte complète de l'expérience utilisateur.

Priorités :
1. Lecture
2. Ajouter
3. File d'attente
4. Invités
5. Mode DJ
6. Animations

## 31 juillet 2026 — Build 0.5 : Recherche musicale V2

- Ajout d’un cache partagé de 24 heures pour éviter de facturer plusieurs fois une même recherche YouTube.
- Normalisation des requêtes : majuscules, accents, ponctuation, espaces et variantes comme `&` / `et` sont regroupés.
- Tolérance aux petites fautes d’orthographe à partir des recherches déjà présentes dans le cache.
- Déduplication des recherches identiques lancées simultanément.
- Restriction des résultats à la catégorie Musique, aux vidéos intégrables et aux vidéos disponibles en France.
- Classement intelligent favorisant les vidéos officielles, les chaînes Topic et VEVO.
- Filtrage renforcé des podcasts, interviews, réactions, Shorts et vidéos hors sujet.
- Vérification de la durée et du statut d’intégration avec `videos.list`.
- Gestion explicite de l’erreur de quota YouTube `429`.

## 31 juillet 2026 — Build 0.6 MusicBrain V1

- Création d'une base musicale locale persistante au format JSON.
- Enregistrement des artistes et morceaux découverts par le moteur de recherche.
- Comptage des recherches, ajouts, lectures et votes.
- Premier apprentissage des enchaînements entre les morceaux.
- Ajout des routes d'administration MusicBrain.
- Ajout de la page `/admin/musicbrain` pour consulter les statistiques et le catalogue appris.
- Préparation de l'architecture pour une future migration vers PostgreSQL.

## 1 août 2026 — PartyBrain Core et persistance Railway

- MusicBrain devient officiellement PartyBrain.
- Ajout d'un niveau d'apprentissage et d'un score de connaissance.
- Fusion automatique des doublons d'artistes et décodage des entités HTML.
- Ajout d'un score par morceau basé sur recherches, ajouts, lectures et votes.
- Ajout d'un export JSON de PartyBrain.
- Le stockage peut désormais être rendu persistant sur Railway grâce à un volume monté dans `/data` et à la variable `PERSISTENT_DATA_DIR=/data`.

## 1 août 2026 — Build 0.8 PartyBrain V2

- Ajout d’un Artist Cleaner pour fusionner les variantes d’un même artiste.
- Nettoyage des titres et décodage des entités HTML.
- Détection des collaborations et apprentissage des relations entre artistes.
- Création d’une constellation musicale interactive accessible via `/admin/partybrain/graph`.
- Migration automatique de la base PartyBrain vers le schéma V2 tout en conservant les données du volume Railway.

## 1 août 2026 — Build 0.9 Music Intelligence Engine

- Enrichissement des résultats YouTube avec les données `videos.list` disponibles.
- Détection prioritaire des Art Tracks via la description « Provided to YouTube by ».
- Extraction du titre propre, de l’artiste principal, des collaborateurs et de l’album lorsque ces informations sont présentes.
- Conservation de la provenance des métadonnées et d’un indice de confiance dans PartyBrain.
- Repli sur le parseur PartyBrain lorsque YouTube ne fournit pas de métadonnées musicales suffisamment fiables.
- Affichage de la provenance des métadonnées dans l’administration PartyBrain.

## 1 août 2026 — Build 1.0 Music Intelligence Core

- Centralisation du nettoyage musical dans `apps/api/src/music-intelligence/`.
- Ajout d’un moteur de métadonnées priorisant les Art Tracks YouTube.
- Nettoyage des titres, sources radio, labels et mentions techniques.
- Séparation fiable de l’artiste principal et des collaborateurs.
- Préservation des groupes connus comme Bigflo & Oli.
- Migration automatique des connaissances PartyBrain existantes.
- Compatibilité maintenue avec le volume persistant Railway `/data`.

## 1 août 2026 — Build 1.2 Live Party

- Refonte animée de la démonstration présente sur la page d'accueil.
- Ajout d'un égaliseur, d'une progression vivante, de transitions de morceaux, de votes et d'invités animés.
- Ajout de particules discrètes et d'apparitions progressives dans le hero.
- Toutes les animations sont locales et ne consomment aucun quota YouTube.
- Le mode de réduction des animations du système est respecté.
