# Build 0.8.1 — Artist Parser

- Extraction fiable des crédits `feat.`, `ft.`, `featuring` et `avec`, y compris entre parenthèses.
- Un nom comme `(ft. Mauvais Djo)` ne peut plus devenir un artiste principal.
- Chaque morceau conserve maintenant `artistName` et `featuredArtistNames` séparément.
- Migration automatique de la base PartyBrain existante au démarrage.
- Reconstruction des relations entre artistes à partir des crédits nettoyés.
