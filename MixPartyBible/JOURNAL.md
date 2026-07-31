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
