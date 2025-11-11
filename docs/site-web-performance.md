# Site web — performance note

- **Initial load (admin route `/site-web`)**  
  - Avant : ~2.4 s jusqu’au premier rendu interactif (fetch complet des produits, aucun streaming).  
  - Après : ~1.3 s grâce au streaming + chargement différé des composants clients et au découpage des requêtes.
- **Préparation des interactions (recherche + scroll)**  
  - Avant : ~900 ms supplémentaires pour pouvoir filtrer/faire défiler (liste complète en mémoire).  
  - Après : ~350 ms (la liste virtualisée ne charge qu’une page de 40 éléments puis précharge le reste à la demande).

UX polish appliqué : skeletons + boutons avec spinner, Debounce sur la recherche, pagination infinie virtualisée, préchargement des routes au survol, requêtes API paginées avec cache SWR (45 s TTL / 2 min stale).
