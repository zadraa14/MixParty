# MixMates — intégration officielle

Cette version inclut 461 MixMates extraits des planches validées.

## Fonctionnalités incluses

- Profil local au premier lancement : prénom + préférence visuelle.
- Attribution aléatoire d’un premier MixMate compatible, sans avantage de jeu.
- Sauvegarde dans `localStorage` sous `mixparty.profile.v1`.
- Collection complète avec raretés, catégories et états verrouillé/débloqué.
- MixMate équipé accessible depuis le bouton flottant.
- Écran « Défis & récompenses » préparé pour les futurs compteurs serveur.
- Système de Cristal MixMate et animation de révélation déjà codés.
- Synchronisation du MixMate des participants via l’API et Socket.IO.
- Migration automatique des anciennes soirées dont les participants étaient de simples chaînes.
- MixMate enregistré sur chaque nouvelle proposition musicale.

## Installation

1. Remplacer le dossier MixParty par celui-ci, ou fusionner les fichiers.
2. Conserver votre vraie clé dans `apps/api/.env` (elle n’est pas incluse dans l’archive).
3. Depuis la racine :

```powershell
npm install
npm run dev
```

## Réinitialiser le test du premier lancement

Dans la console du navigateur :

```js
localStorage.removeItem("mixparty.profile.v1");
location.reload();
```

## Étape serveur ultérieure

Les défis affichent actuellement leur modèle visuel. Pour les rendre réellement réclamables sur plusieurs appareils, les statistiques, cristaux et collections devront être associés à un compte en base de données.
