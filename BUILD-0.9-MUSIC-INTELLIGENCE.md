# Build 0.9 — Music Intelligence Engine

- Enrichissement des résultats YouTube avec les métadonnées disponibles dans `videos.list`.
- Détection prioritaire des Art Tracks via la description « Provided to YouTube by ».
- Extraction du titre, de l’artiste principal, des collaborateurs et de l’album lorsqu’ils sont présents.
- Repli sur l’analyse du titre, de la chaîne et de la requête lorsque les métadonnées structurées ne sont pas disponibles.
- Conservation de la source et d’un indice de confiance dans PartyBrain.
- Affichage de la provenance des métadonnées dans l’administration PartyBrain.

Important : l’API YouTube ne fournit pas de champs musicaux universels `artist` ou `album` pour toutes les vidéos. Le moteur utilise donc les descriptions d’Art Tracks lorsqu’elles existent, puis un parseur de secours.
