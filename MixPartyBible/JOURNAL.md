# Journal MixParty

## 31 juillet 2026

- Reprise du projet à partir de l’archive `MixParty-MixMates-officiel`.
- Décision confirmée : mise en suspens des MixMates.
- Nettoyage du frontend, de l’API, des styles, des données et des images MixMates.
- Remplacement des avatars MixMates des participants par une pastille avec leur initiale.
- Création du dossier `MixPartyBible`.
- Prochaine étape : poursuivre le design de la V1.
## 31 juillet 2026 — Correction des boutons lumineux

- Correction de l’animation lumineuse des boutons **Titre suivant**, **Lancer le DJ** et **Rechercher**.
- Le reflet animé est désormais masqué à l’intérieur des bords arrondis grâce à `overflow: hidden` sur la classe commune `.party-action`.
- L’apparence et le halo externe des boutons sont conservés.


## 31 juillet 2026 — Robustesse des données de soirée
- Correction d’un crash sur la page de soirée lorsque l’API renvoie temporairement une soirée sans tableau `songs`.
- Normalisation des données reçues par HTTP et Socket.IO : `songs`, `history` et `participants` utilisent désormais un tableau vide par défaut.
- La file d’attente DJ reste fonctionnelle même pendant un chargement ou avec d’anciennes données incomplètes.

## 31 juillet 2026 — Réparation du QR code sur téléphone
- Le lancement détecte désormais automatiquement l’adresse IPv4 locale du PC.
- Le QR code encode l’adresse réseau du PC au lieu de `localhost`.
- Le serveur web écoute sur toutes les interfaces réseau grâce à `--hostname 0.0.0.0`.
- Une seule commande reste nécessaire : `npm run dev`.
- Le téléphone et le PC doivent être connectés au même réseau Wi-Fi pour les tests locaux.


## 31 juillet 2026 — Accès téléphone et chargement de soirée
- Correction du chargement infini sur téléphone.
- Les appels API et Socket.IO passent désormais par le port 3000 via un proxy Next.js.
- Le téléphone n’a plus besoin d’accéder directement au port 4000.
- Ajout d’un message d’erreur et d’un bouton « Réessayer » si la soirée ne peut pas être chargée.


## 31 juillet 2026 — Proxy API téléphone renforcé
- Remplacement de la réécriture Next.js par une vraie route proxy interne `/mixparty-api/[...path]`.
- Ajout d’un délai maximal de 10 secondes pour empêcher le chargement infini.
- Le chargement initial de la soirée passe uniquement par le port 3000.
- Les erreurs de connexion à l’API sont maintenant visibles dans PowerShell et dans l’interface.


## 31 juillet 2026 — Chargement mobile corrigé
- Vérification : le proxy `/mixparty-api` répond correctement depuis le téléphone.
- Le chargement de la page soirée utilise maintenant une URL relative et un timeout compatible avec tous les navigateurs mobiles.
- Le cache `.next` est automatiquement supprimé à chaque lancement en développement pour éviter une ancienne version bloquée.

## 31 juillet 2026 — Sprint expérience soirée V1.1

- Participants connectés rétablis avec présence réelle : heartbeat toutes les 8 secondes, actualisation de secours et retrait automatique après déconnexion.
- Ajout d'un identifiant local unique par participant afin d'éviter les doublons de prénom.
- Nouveau lecteur orienté musique : pochette mise en avant, informations du morceau, visualiseur et bouton pour ouvrir/fermer le clip YouTube.
- Refonte de la navigation mobile avec barre fixe : Lecture, Ajouter, File, Invités et Inviter.
- Ajout des profils : import d'une photo personnelle (2 Mo maximum) ou choix parmi 18 avatars MixParty originaux.
- Les avatars sont transmis et affichés dans la liste des participants en temps réel.

## 31 juillet 2026 — Compatibilité navigateurs mobiles

- Remplacement de `crypto.randomUUID()` par un générateur avec solution de repli compatible HTTP local sur iPhone.
- Ajout de `suppressHydrationWarning` sur la racine de l’application pour tolérer les attributs injectés par les fonctions de traduction du navigateur avant le chargement React.

## 31 juillet 2026 — Recherche musicale fiabilisée

- Ajout d’un délai maximal sur la requête Google YouTube côté API.
- Gestion claire des clés absentes, quotas, restrictions et erreurs réseau.
- Ajout d’un délai maximal et d’un message visible côté interface.
- La recherche ne peut plus rester bloquée indéfiniment.
