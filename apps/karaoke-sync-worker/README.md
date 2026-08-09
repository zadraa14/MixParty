# MixParty Karaoke Sync Worker V1.9 — Intro Recovery

Cette version cible uniquement un défaut observé sur ABCD :
Faster-Whisper ratait la toute première ligne courte ("A-B, C-D") et
l'accrochait beaucoup trop tard.

## Intro Recovery
- analyse uniquement les 0 à 15 premières secondes
- cible seulement les 3 premières lignes LRCLIB
- ne touche pas à une ligne déjà à moins de 2,5 s de LRCLIB
- stratégie spéciale pour les fragments très courts
- contrôle obligatoire avec la ligne suivante
- impossible d'insérer une ligne après 15 s

## Pipeline
1. alignement Faster-Whisper normal
2. Intro Recovery
3. Local Refinement V1.8
4. recalcul complet de la confiance
5. certification seulement si score >= 92 %

Shadow Mode inchangé.
