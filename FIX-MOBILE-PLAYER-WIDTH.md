# Correctif largeur du lecteur mobile

Le problème venait de l'iframe YouTube qui pouvait temporairement imposer une largeur
supérieure à son conteneur pendant sa création ou son rechargement.

Le correctif :

- force tous les parents du lecteur à `min-width: 0` ;
- limite leur largeur à 100 % ;
- force l'iframe YouTube à rester dans le cadre 16:9 ;
- empêche le lecteur d'élargir la page mobile ;
- conserve le comportement desktop et le plein écran.
