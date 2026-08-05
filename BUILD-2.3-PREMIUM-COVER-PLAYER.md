# MixParty Build 2.3 — Nouveau lecteur visuel premium

## Principe

Le moteur YouTube est conservé intact et continue d'assurer la lecture, la pause,
le passage au morceau suivant, la synchronisation et la télémétrie.

L'iframe reste montée dans la page mais devient visuellement transparente et
inaccessible aux interactions. La couche MixParty est affichée au-dessus.

## Affichage

- `coverStatus = found` et `coverUrl` présente : jaquette HD.
- Dans tous les autres cas : logo MixParty.
- Le fond du lecteur reprend la jaquette lorsqu'elle existe.
- Sans jaquette, un fond MixParty orange, violet et cyan est utilisé.

## Écrans concernés

- lecteur principal de l'appareil DJ ;
- lecteur synchronisé des participants ;
- petite pochette dans la console ;
- mode TV.

## Non modifié

- création du lecteur YouTube ;
- commandes play / pause / next ;
- synchronisation ;
- PartyBrain ;
- événements de lecture ;
- mode DJ.
