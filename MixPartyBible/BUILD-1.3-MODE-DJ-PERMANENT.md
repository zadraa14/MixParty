# Build 1.3 — Mode DJ permanent

Date : 01/08/2026

## Objectif

Rendre l'appareil qui diffuse la musique beaucoup plus fiable pendant une soirée, sans chercher à contourner les restrictions de lecture en arrière-plan de YouTube ou des navigateurs mobiles.

## Fonctionnalités

- activation explicite du Mode DJ sur l'appareil contrôleur ;
- maintien de l'écran allumé avec la Wake Lock API quand elle est disponible ;
- passage en plein écran à l'activation ;
- reconnexion Socket.IO automatique lors du retour du réseau ;
- resynchronisation de la lecture lors du retour sur l'onglet ;
- avertissement avant fermeture ou rechargement pendant une diffusion ;
- bouton « Reprendre la lecture » lorsqu'un navigateur mobile bloque la reprise ;
- état réseau, batterie, Wake Lock et durée de session visibles ;
- désactivation propre du plein écran et du Wake Lock.

## Limite assumée

Le Mode DJ améliore fortement la fiabilité tant que MixParty reste ouvert. Il ne garantit pas la lecture lorsque le navigateur est fermé ou lorsque le téléphone verrouille complètement l'application, car YouTube et les systèmes mobiles imposent leurs propres restrictions.
