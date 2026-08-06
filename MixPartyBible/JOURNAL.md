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

## 01/08/2026 — Build 1.3 Mode DJ permanent

Ajout d'un mode de diffusion dédié : écran maintenu allumé, plein écran, reconnexion réseau, protection contre la fermeture accidentelle, reprise manuelle de lecture et indicateurs de santé de l'appareil DJ.

## 01/08/2026 — Build 1.4 PartyBrain Academy V1

- Ajout de l'apprentissage automatique avant la remise à zéro réelle du quota YouTube.
- Suppression de la réserve fixe : Academy utilise le quota estimé restant dans la dernière fenêtre.
- Ajout d'un compteur de quota persistant partagé entre les recherches utilisateur et Academy.
- Ajout des missions d'enrichissement priorisées selon les artistes réellement demandés.
- Ajout du journal, des rapports de session et du tableau de bord Academy dans `/admin/musicbrain`.
- Arrêt automatique en cas d'erreur 429 ou quelques secondes avant la réinitialisation.

## 01/08/2026 — Build 1.4.1

- Ajout du tableau de bord complet PartyBrain Academy.
- Historique des 7 dernières sessions.
- Statistiques de recherches, morceaux, artistes et incidents.
- Graphique de progression récente.
- Rafraîchissement automatique pendant l'apprentissage.

📖 MixParty Bible — Mise à jour (02 août 2026)
🎉 Milestone majeur atteint : PlayerCore V2
✅ Objectif

Résoudre le plus gros problème de MixParty :

Sur téléphone, le DJ devait appuyer sur Play à chaque changement de musique.

Ce problème empêchait une utilisation naturelle de l'application pendant une soirée.

🔍 Cause identifiée

Le lecteur YouTube était détruit puis recréé à chaque changement de morceau.

Conséquences :

nouvelle iframe à chaque titre ;
perte de l'autorisation d'autoplay ;
obligation de relancer la lecture manuellement sur mobile.
✅ Solution retenue

Mise en place d'un lecteur YouTube persistant.

Principe :

une seule instance YT.Player est créée au lancement ;
l'iframe reste vivante pendant toute la soirée ;
les morceaux suivants sont chargés avec loadVideoById() ;
aucune recréation du lecteur.
✅ Résultats

Tests validés sur Railway :

✅ PC
✅ iPhone

Séquence validée :

CREATE_PLAYER
READY
PLAY_REQUEST
PLAYING
ENDED
NEXT_SONG_REQUEST
LOAD_VIDEO_BY_ID
BUFFERING
PLAYING

Le changement automatique fonctionne désormais sans intervention du DJ.

🔧 Debug

Le Player Audit est conservé dans le projet mais masqué via :

const DEBUG_PLAYER = false;

En cas de besoin :

const DEBUG_PLAYER = true;

Le panneau de diagnostic réapparaît immédiatement.

🚀 Impact sur MixParty

Le principal verrou technique du projet est levé.

L'expérience utilisateur est désormais conforme à la vision initiale :

le DJ connecte son téléphone à l'enceinte ;
lance uniquement la première musique ;
les invités ajoutent des titres et votent ;
la playlist évolue automatiquement ;
les morceaux s'enchaînent sans intervention.

MixParty est désormais techniquement viable pour des tests en conditions réelles.

📋 Prochaines priorités
Tests longue durée (30 à 100 morceaux).
Tests sur plusieurs appareils Android et iPhone.
Validation de la stabilité.
Reprise de la roadmap fonctionnelle (MixMate, IA, animations, statistiques, etc.).

## V6.2 — PartyBrain Intelligence Event Engine

- Ajout d'un journal d'événements comportementaux append-only.
- Séparation confirmée entre PartyBrain Academy (connaissance musicale) et PartyBrain Intelligence (comportement des soirées).
- Événements : création, arrivée/départ, ajout, vote, lecture, progression, fin et skip.
- Participants pseudonymisés par hash ; aucun nom en clair dans le journal analytique.
- Ajouts distingués entre recherche manuelle et suggestion PartyBrain.
- API de statistiques, consultation et export JSONL.
## V6.3 — Finition 

Design du mode TV

On a finalisé tout le rendu du mode TV :

ajout d’une image de foule/concert dans le bloc de lecture ;
ajout de la même image en arrière-plan général ;
arrière-plan général fortement flouté pour ne garder que les couleurs ;
conservation de l’image nette dans le bloc de lecture ;
correction du fond qui avait disparu dans le bloc ;
ajout d’un contour néon autour de la jaquette du mode TV ;
conservation des boutons, du lecteur, des avatars et du volume YouTube.
Console DJ

On a aussi amélioré la jaquette de la console de lecture normale :

ajout d’un néon autour de la jaquette du mode lecture ;
modification ciblée uniquement sur la jaquette ;
aucun changement sur le mode TV, les fonds ou la file d’attente.
Avatars des interactions

On a rétabli les avatars dans Dernières interactions :

avatar lors de l’arrivée d’un participant ;
avatar lors de l’ajout d’une musique ;
avatar lors d’un vote ;
avatar animal par défaut lorsqu’il n’y a pas de photo personnelle.
Optimisation mobile

On a fait une première vraie passe d’optimisation pour téléphone :

désactivation des animations lourdes du fond sur mobile ;
suppression des particules, rubans, vagues, grille et bruit animé ;
réduction des effets de flou trop coûteux ;
arrêt de plusieurs animations continues sur téléphone ;
conservation d’un fond statique avec les couleurs MixParty ;
aucun changement sur la version ordinateur.
Correction des votes sur téléphone

On a corrigé le problème des doubles boutons :

première correction pour regrouper le compteur et le vote ;
puis, après ton test, suppression du grand bouton horizontal ;
conservation uniquement du petit bouton de vote à droite dans la file.
Railway

On a vérifié les erreurs rouges dans les logs :

le message SIGTERM correspond principalement à l’arrêt de l’ancien conteneur lors d’un nouveau déploiement ;
ton serveur démarre correctement ;
ta consommation actuelle est très faible ;
environ 0,43 $ utilisés sur la période affichée ;
le forfait Railway Hobby à 5 $/mois devrait largement suffire pour la bêta ;
on a repéré beaucoup de logs envoyés rapidement, à nettoyer plus tard.
Première version publique

On a conclu que l’application était prête pour une :

MixParty V1 — Bêta publique

Il reste surtout à faire tester l’application dans de vraies conditions avec plusieurs téléphones et un ordinateur.

Nom de domaine

On a recherché un domaine :

mixparty.fr était déjà pris ;
mixpartyapp.fr était disponible ;
tu as acheté mixpartyapp.fr chez OVH ;
prix payé : 5,99 € TTC pour la première année ;
DNSSEC et une adresse Zimbra Starter sont inclus ;
aucune offre d’hébergement OVH supplémentaire n’a été achetée.
Adresse e-mail professionnelle

On a prévu de créer :

contact@mixpartyapp.fr

Ton compte OVH reste associé à ton adresse e-mail personnelle pour éviter de perdre l’accès au domaine.

Recherche sur la marque MixParty

On a fait une première recherche sérieuse :

le nom n’est pas totalement vierge ;
il existe des usages de MixParty ou Mix Party dans plusieurs pays ;
il existe une activité française liée aux soirées avec un nom proche ;
aucune marque française ou européenne exacte clairement identifiée pour une application musicale collaborative ;
niveau de risque estimé : modéré ;
dépôt INPI à envisager plus tard, après une recherche de similarités plus approfondie.

Tarif envisagé pour le dépôt :

1 classe : 190 €
2 classes : 230 €
3 classes : 270 €
Connexion du domaine à Railway

On a commencé la configuration :

ajout de mixpartyapp.fr dans Railway ;
récupération du CNAME Railway ;
récupération du TXT de vérification ;
création d’un compte Cloudflare ;
ajout de mixpartyapp.fr dans Cloudflare ;
import automatique des DNS OVH ;
conservation des enregistrements e-mail OVH :
MX ;
SPF ;
ajout du CNAME Railway ;
ajout du TXT _railway-verify ;
choix du mode DNS uniquement pour commencer.
Étape actuellement en attente

Chez OVH, DNSSEC est actuellement :

En cours de désactivation

On s’est arrêté ici pour éviter de casser le domaine.

Demain, on devra :

vérifier que DNSSEC est bien désactivé ;
remplacer les serveurs DNS OVH par :
konnor.ns.cloudflare.com
lara.ns.cloudflare.com
attendre l’activation de Cloudflare ;
vérifier la validation du domaine dans Railway ;
tester :
https://mixpartyapp.fr
créer ensuite :
contact@mixpartyapp.fr
À ajouter dans la MixParty Bible
- Mode TV finalisé avec double fond net/flou
- Néon ajouté autour de la jaquette TV
- Néon ajouté autour de la jaquette Console DJ
- Avatars des interactions restaurés
- Optimisation mobile V1
- Animations lourdes désactivées sur téléphone
- Double bouton de vote corrigé
- MixParty validée pour une bêta publique V1
- Domaine mixpartyapp.fr acheté chez OVH
- Cloudflare configuré
- CNAME et TXT Railway ajoutés
- DNSSEC OVH en cours de désactivation
- Connexion finale du domaine à terminer
- Adresse contact@mixpartyapp.fr à créer