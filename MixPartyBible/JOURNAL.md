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


📖 MIXPARTY BIBLE — Session du 10 août 2026
🎤 KARAOKÉ — SYNC ENGINE / BENCHMARK
🎯 Objectif de la session

Continuer le développement du système permettant à MixParty de générer automatiquement des timings de paroles suffisamment fiables pour le mode Karaoké, sans avoir à traiter manuellement chaque morceau.

Objectif à terme :

Audio → paroles → Sync Engine → timings → contrôle qualité → Karaoké MixParty

Le système doit pouvoir fonctionner automatiquement sur un grand catalogue.

⚙️ Karaoke Sync Worker

Le worker dédié au traitement audio est maintenant déployé séparément sur Railway :

Service : karaoke-sync-worker

Le serveur démarre correctement avec Uvicorn sur le port Railway.

Health check validé.

Configuration observée :

service: mixparty-karaoke-sync-worker
engine: faster-whisper
model: base
device: cpu
computeType: int8
minimumConfidence: 92
pyannote: false
whisperx: false
Bug corrigé

Lors des premiers tests, /align-upload retournait :

500 Internal Server Error
ModuleNotFoundError: No module named 'requests'

La dépendance manquante a été ajoutée.

Après correction, le worker a pu réellement analyser les fichiers audio envoyés par MusicBrain.

🧠 ÉVOLUTION DU SYNC ENGINE

Plusieurs itérations du moteur ont été testées aujourd'hui.

On est notamment passé par :

faster-whisper-v1.4
faster-whisper-v1.5
faster-whisper-v1.6
faster-whisper-v1.7
...
faster-whisper-v1.9
faster-whisper-v2.0

Les tests ont permis d'ajouter progressivement plusieurs diagnostics.

Informations maintenant calculées

Le moteur peut notamment retourner :

confiance globale ;
couverture des paroles ;
nombre de lignes alignées ;
similarité moyenne ;
timestamps croissants ;
probabilité des mots ;
delta médian par rapport à LRCLIB ;
précision à ±0,50 s ;
précision à ±0,75 s ;
détection de doublons suspects ;
correction locale ;
offset global ;
delta médian avant correction ;
modèle Whisper utilisé.
🛠️ CORRECTION LOCALE

Un système de correction locale a été expérimenté.

But :

Ne pas décaler toute une chanson lorsqu'une ou quelques lignes seulement semblent mal positionnées.

Le moteur analyse certaines lignes suspectes et cherche localement une meilleure position dans l'audio.

Des sécurités ont été ajoutées pour éviter les corrections dangereuses :

no-safe-local-match
no-word-window

Une correction n'est appliquée que lorsque le moteur estime disposer de suffisamment d'éléments.

🔎 COMPARAISON LRCLIB ↔ SYNC ENGINE

Un diagnostic détaillé permet maintenant de comparer :

timestamp LRCLIB
↕
timestamp calculé par notre moteur

Avec affichage du delta pour chaque ligne.

Exemple :

L 30.09s
E 30.12s
+0.03s

Cela nous a permis de constater quelque chose d'important :

LRCLIB est utilisé comme référence comparative mais ne doit pas être considéré comme une vérité absolue.

Un écart avec LRCLIB ne signifie donc pas automatiquement que notre moteur est faux.

🎵 PREMIER MORCEAU DE TEST — GIMS

Morceau principalement utilisé pendant le développement :

GIMS — ABCD (Pilule rouge)

Différentes versions du moteur ont produit environ :

Couverture : ~96,8 %
Lignes alignées : 30 / 31
Similarité moyenne : ~74,5 %

Mais la confiance finale est restée sous le seuil de certification.

Selon les itérations, elle tournait autour de :

82–87 %

Le morceau restait donc refusé par le système de certification très strict.

Conclusion importante :

le moteur fonctionne, mais notre système de validation est actuellement extrêmement sévère.

🌐 PROBLÈME DES MP3

Nous avons d'abord envisagé de fournir manuellement plusieurs MP3 afin de tester le moteur.

Cette approche a été abandonnée.

Décision :

L'utilisateur ne doit pas avoir à télécharger ou fournir manuellement des dizaines de MP3 pour entraîner/tester MixParty.

Il fallait trouver une source audio permettant un benchmark automatisé.

🎶 INTÉGRATION JAMENDO

Création/configuration d'une application MixParty sur Jamendo.

Un JAMENDO_CLIENT_ID a été obtenu et ajouté aux variables Railway de MixParty.

Objectif :

Permettre à MusicBrain de récupérer automatiquement des morceaux disposant d'audio exploitable afin de tester le Sync Engine.

Résultat :

plus besoin de fournir manuellement les MP3 pour le benchmark.

📚 CATALOGUE KARAOKÉ

La base affichée par MusicBrain contient maintenant :

2 022 morceaux synchronisés

avec actuellement jusqu'à :

500 morceaux affichés dans l'interface.

Chaque morceau conserve notamment :

titre ;
artiste ;
pochette ;
durée ;
identifiant LRCLIB ;
statut synchronisé ;
bouton de test Sync Engine.
🧪 BENCHMARK AUTOMATIQUE 50 MORCEAUX

Une nouvelle section a été ajoutée :

BENCHMARK SYNC ENGINE
Test automatique sur 50 morceaux

MusicBrain :

récupère automatiquement 50 morceaux Jamendo ;
récupère leur audio ;
récupère les paroles disponibles ;
envoie les morceaux un par un au Sync Engine ;
mesure score et couverture ;
classe le résultat.

Aucun MP3 manuel nécessaire.

L'interface affiche en direct :

PROGRESSION
PASSÉS
REFUSÉS
ERREURS
TAUX

ainsi que le morceau actuellement analysé.

📊 PREMIER BENCHMARK COMPLET

Résultat final :

50 / 50 analysés

✅ Passés : 9
❌ Refusés : 41
⚠️ Erreurs techniques : 0

Taux de validation : 18 %
Point très important

0 erreur technique.

Le pipeline complet fonctionne donc correctement.

Le problème actuel concerne principalement la certification / qualité d'alignement, pas l'infrastructure.

📈 ANALYSE DES RÉSULTATS

Les morceaux acceptés possèdent généralement une excellente combinaison :

score élevé
+
couverture élevée

Exemples :

Explosive Ear Candy
96,8 % / couverture 100 % ✅

The Devil Music Co.
92,7 % / couverture 100 % ✅

Marco Margna
94,9 % / couverture 100 % ✅

Danielle Helena
92,9 % / couverture 100 % ✅

MoOt
90,4 % / couverture 100 % ✅

The Monster Brothers
88,4 % / couverture 100 % ✅

The.madpix.project
88,2 % / couverture 90,9 % ✅

madelyn munsell
86 % / couverture 95,8 % ✅

Swear and Shake
85,7 % / couverture 85 % ✅

Mais plusieurs morceaux refusés sont relativement proches :

THE DLX
82,8 % / 88,2 % ❌

Jill Zimmerman
83,4 % / 87,5 % ❌

Stephane TV
78,5 % / 87,5 % ❌

Emerald Park
80,5 % / 81,5 % ❌

Tamara Laurel
84,9 % / 76,9 % ❌

À l'inverse, certains refus sont clairement mauvais :

John Dada & the Weathermen
47,2 % / couverture 9,1 %

Ben Lvcas
52,1 % / couverture 22,5 %

Emily Richards
47,7 % / couverture 20 %
💡 CONCLUSION IMPORTANTE

Le chiffre de 18 % de réussite ne signifie pas nécessairement que le Sync Engine est inutilisable.

Actuellement, le système mélange dans REFUSÉ :

des morceaux presque acceptables ;
des morceaux moyens ;
des morceaux totalement inutilisables.

La certification binaire :

✅ PASSÉ
❌ REFUSÉ

n'est donc probablement pas suffisamment informative.

🚦 PROCHAINE ÉVOLUTION DÉCIDÉE

Décision prise mais pas développée aujourd'hui :

remplacer/analyser la certification avec trois catégories.

🟢 CERTIFIÉ

Très forte confiance.

Peut être utilisé automatiquement pour le Karaoké.

🟠 À VÉRIFIER / RÉCUPÉRABLE

Alignement prometteur mais pas suffisamment fiable pour publication automatique.

Cette catégorie permettra notamment d'isoler les morceaux autour de :

75–85 % de score
+
bonne couverture
🔴 REFUSÉ

Correspondance réellement insuffisante :

couverture très faible ;
transcription mauvaise ;
alignement insuffisant ;
audio/paroles incompatibles ;
autres anomalies importantes.
⛔ DÉCISION SUR LE KARAOKÉ

Le mode Karaoké n'est pas abandonné pour le moment.

Mais décision prise de ne plus passer des heures à modifier arbitrairement les seuils.

La prochaine étape sera de déterminer automatiquement pourquoi les morceaux échouent.

Si les refus proviennent principalement d'un problème commun pouvant être corrigé globalement → poursuite du développement.

Si les morceaux nécessitent des corrections individuelles ou que le moteur reste insuffisamment fiable → mise en pause/abandon du Karaoké pour se concentrer sur le cœur de MixParty.

📌 ÉTAT EN FIN DE SESSION
Karaoke Sync Worker Railway     ✅
Health check                    ✅
Upload audio → Worker           ✅
Faster-Whisper                  ✅
Analyse automatique             ✅
Correction locale               ✅
Diagnostic LRCLIB ↔ Engine      ✅
Jamendo connecté                ✅
Benchmark sans MP3 manuel       ✅
50 morceaux analysés            ✅
Erreurs techniques              0
Certification fiable à grande
échelle                         ❌ À améliorer

Benchmark :
9 / 50 certifiés
41 / 50 refusés
18 % de validation
🔜 À reprendre plus tard

Créer la classification 🟢 / 🟠 / 🔴 et analyser automatiquement les causes des 41 refus avant toute nouvelle modification du Sync Engine.

Le but de la prochaine session Karaoké ne sera donc PAS de relancer immédiatement un benchmark, mais d'exploiter correctement les données que nous avons déjà obtenues.

# Session du 19 août 2026 — Google Auth / Fin de soirée / Homepage mobile

## ✅ GOOGLE SIGN-IN — VALIDÉ EN LOCAL

Mise en place de la connexion Google réelle pour les comptes MixParty.

### Fonctionnement
- Bouton officiel Google Identity Services.
- OAuth Client Google configuré en type "Application Web".
- Origines autorisées :
  - http://localhost:3000
  - https://mixpartyapp.fr
- Variables :
  - Web : NEXT_PUBLIC_GOOGLE_CLIENT_ID
  - API : GOOGLE_CLIENT_ID
- Le token Google est vérifié côté API.
- Si l’adresse Google correspond déjà à un compte MixParty, le même compte est réutilisé.
- Sinon, création automatique du compte.
- Une connexion Google reprend ensuite automatiquement l’action initiale :
  - créer une soirée
  - rejoindre une soirée
- Stratégie compte confirmée :
  - Google ✅
  - e-mail ✅
  - profil éphémère ✅
  - Apple plus tard lors de la publication iOS.

Google Sign-In testé et validé en local.

---

## ✅ CORRECTIF API AUDIO

Correction TypeScript du Blob Node :

Ancien :
new Blob([audioBuffer])

Nouveau :
new Blob([new Uint8Array(audioBuffer)])

Important : conserver ce correctif lors des futures modifications de apps/api/src/index.ts.

---

# ✅ FIN DE SOIRÉE + CLASSEMENT FINAL

Nouveau système permettant au DJ de clôturer officiellement une soirée.

## DJ

Ajout d’un bouton :
"Terminer la soirée"

Visible uniquement pour l’organisateur / DJ.

Une confirmation est affichée avant clôture.

Lors de la validation :
- la soirée est clôturée ;
- les participations sont finalisées ;
- les résultats sont figés ;
- le classement final est généré ;
- les podiums / victoires / badges permanents continuent d’utiliser leurs règles existantes ;
- tous les appareils présents reçoivent l’événement party_ended ;
- redirection vers le récap de la soirée.

---

## ✅ Classement final

Le classement affiche maintenant :

- comptes MixParty permanents ;
- profils éphémères ;
- pseudo ;
- avatar ;
- PartyScore ;
- votes reçus ;
- morceaux ajoutés.

PartyScore V1 :
total des votes reçus sur les morceaux ajoutés pendant la soirée.

Les profils éphémères sont visibles dans le classement mais ne reçoivent pas de progression persistante.

La règle des 30 minutes reste appliquée pour les statistiques / podiums / victoires / badges officiels des comptes permanents, mais elle ne masque plus les participants du récap de soirée.

Test validé :
- compte permanent Benjamin : #1 / 8 PartyScore
- profil éphémère Ben : #2 / 3 PartyScore

---

## ✅ RÉCAP PERMANENT DE SOIRÉE

Nouvelle page :

/party/[code]/result

Le récap affiche notamment :
- date de la soirée ;
- organisateur ;
- durée ;
- nombre de participants ;
- votes ;
- morceaux joués ;
- podium ;
- classement complet ;
- PartyScore ;
- morceaux les plus votés ;
- "Banger de la soirée".

Un snapshot du résultat est enregistré avant suppression de la soirée active.

Les comptes ayant participé peuvent retrouver ensuite le récap depuis :

Profil → Historique → Voir le récap

Testé et validé en local.

---

# ✅ HOMEPAGE MOBILE — V9 VALIDÉE

Après plusieurs essais, nouvelle direction mobile officiellement validée.

La homepage téléphone doit être pensée comme une vraie interface d’application et NON comme une landing page PC réduite.

## Structure mobile validée

En haut :
- logo officiel MixParty ;
- statut LIVE / profil ;
- menu.

Hero :
- texte en haut à gauche ;
- faux téléphone MixParty en haut à droite.

Texte principal obligatoire :
"La soirée appartient à tout le monde !"

Le slogan doit rester une identité centrale de MixParty.

À droite :
- faux téléphone premium ;
- lecteur MixParty ;
- jaquette ;
- source YouTube visible ;
- progression ;
- votes ;
- file d’attente.

Sous le hero :
1. Créer ma soirée
2. Rejoindre une soirée

Puis :
- Reprendre ma soirée

Puis 4 cartes premium colorées :
- Musique illimitée
- Tous ensemble
- Badges & stats
- PartyBrain

Puis navigation mobile :
- Accueil
- Créer
- Rejoindre
- Profil

## Règles visuelles mobile

- simple ;
- immédiatement compréhensible ;
- lisible ;
- premium ;
- coloré MixParty ;
- violet / rose / orange / cyan ;
- pas de longue landing page ;
- éviter le scroll inutile ;
- aucun effet animé lourd ;
- priorité aux téléphones peu puissants ;
- pas de mention Karaoké tant que la fonctionnalité est à l’arrêt.

La version PC reste indépendante et ne doit pas être cassée.

Homepage mobile V9 validée par Benjamin le 19/08/2026.

---

# 🔜 PROCHAINE SESSION

Refonte de l’intérieur d’une soirée sur téléphone.

Méthode :
- travailler onglet par onglet ;
- valider visuellement chaque onglet avant de continuer ;
- garder la même DA premium / simple / lisible que la Homepage Mobile V9 ;
- préserver toutes les fonctionnalités existantes ;
- revoir visuellement le lecteur YouTube tout en respectant les règles YouTube ;
- aucune régression desktop ;
- conception compatible avec les futures applications iOS / Android.