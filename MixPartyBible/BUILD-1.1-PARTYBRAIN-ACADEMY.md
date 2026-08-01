# 🧠 BUILD 1.1 — PartyBrain Academy

Date : 01/08/2026

---

# Vision

PartyBrain devient un moteur d'apprentissage autonome.

Son objectif n'est plus seulement de mémoriser les recherches des utilisateurs.

Il doit enrichir automatiquement sa base musicale afin de réduire progressivement la dépendance à l'API YouTube.

Chaque journée rend MixParty plus intelligent.

---

# Philosophie

Les utilisateurs ne remplissent plus simplement une file d'attente.

Ils entraînent PartyBrain.

Chaque recherche améliore la connaissance musicale de MixParty.

L'objectif est de construire une base musicale propriétaire.

---

# Cycle général

Utilisateurs

↓

PartyBrain observe

↓

Construction des missions

↓

Attente de la fenêtre avant réinitialisation du quota

↓

PartyBrain Academy

↓

Nouveaux morceaux

↓

Nouvelle base

↓

Meilleures suggestions

↓

Moins d'appels API

---

# Observation

Pendant toute la journée PartyBrain enregistre :

- artistes recherchés
- morceaux ajoutés
- fréquence des recherches
- artistes incomplets
- collaborations détectées

Aucune recherche automatique n'est effectuée pendant cette phase.

PartyBrain observe uniquement.

---

# Missions

PartyBrain construit automatiquement des missions.

Exemple :

Mission 1

Compléter Bigflo & Oli

Priorité : 98 %

Mission 2

Compléter GIMS

Priorité : 94 %

Mission 3

Découvrir les collaborations de SCH

Priorité : 83 %

Les missions sont recalculées automatiquement chaque jour.

---

# Déclenchement

PartyBrain Academy ne fonctionne PAS à heure fixe.

Le déclenchement est basé sur le quota YouTube.

Condition :

Le quota va bientôt être réinitialisé

ET

Il reste plus de quota que la réserve protégée.

↓

PartyBrain Academy démarre.

---

# Gestion du quota

Configuration actuelle

Quota quotidien :

100 recherches

Réserve :

20 recherches

Exemple :

Quota restant :

37

↓

Réserve :

20

↓

Budget Academy :

17 recherches

PartyBrain n'utilise jamais la réserve.

Si une erreur 429 apparaît :

↓

Arrêt immédiat.

---

# Priorités d'apprentissage

Ordre :

1. compléter les artistes connus

2. compléter les albums

3. compléter les collaborations

4. découvrir les artistes liés

5. découvrir de nouveaux artistes

Aucune recherche n'est lancée au hasard.

---

# Music Parser

Priorité majeure du Build 1.1.

Objectif :

Transformer automatiquement les titres YouTube en données propres.

Exemple :

Avant

Bigflo & Oli feat. Jul - XXXXX

Après

Artiste principal :

Bigflo & Oli

Featuring :

Jul

Titre :

XXXXX

Le parser devra également supprimer automatiquement :

- Official Video
- Lyrics
- HD
- Release
- Audio
- Clip officiel
- etc.

---

# PartyBrain Academy

Nouvelle interface d'administration

/admin/academy

Affichera :

- quota restant
- réserve
- temps avant reset
- missions
- progression
- rapport quotidien

---

# Rapport quotidien

Exemple

Aujourd'hui

✓ 24 recherches

✓ 186 morceaux

✓ 13 albums

✓ 9 collaborations

✓ 412 relations

✓ 0 doublon

---

# Vision long terme

Créer un cerveau musical capable de :

- connaître les artistes
- connaître leurs albums
- connaître leurs collaborations
- apprendre des habitudes des utilisateurs
- proposer les meilleurs enchaînements
- réduire progressivement la consommation de quota
- devenir chaque jour plus intelligent

---

# État du projet

## Build 1.0 ✅

- Cache intelligent
- PartyBrain
- Base persistante Railway
- Art Tracks
- Métadonnées
- Suggestions
- Admin MusicBrain
- Scores

## Build 1.1 🚧

- PartyBrain Academy
- Music Parser
- Missions intelligentes
- Gestion automatique du quota
- Rapports quotidiens

---

# Citation du Build 1.1

> Chaque soirée rend MixParty plus intelligent.

Cette phrase devient la philosophie officielle de PartyBrain.