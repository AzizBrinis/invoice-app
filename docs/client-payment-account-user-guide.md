# Guide d'utilisation du compte "Paiements clients"

## Vue d'ensemble

Le mode "Paiements clients" est un espace de travail simplifié, centré sur le suivi des encaissements client.

Dans l'implémentation actuelle, ce n'est pas un "type d'utilisateur" séparé. C'est un type de compte/espace. Une fois activé correctement, l'utilisateur voit un espace réduit avec surtout :

- `Tableau de bord`
- `Clients`

Le coeur du travail se fait ensuite dans le dossier de chaque client.

## 1. Comment reconnaître que vous êtes dans le bon espace

1. Connectez-vous depuis `/connexion`.
2. Ouvrez votre session normalement.
3. Vérifiez l'en-tête de l'application.

Vous êtes dans le bon espace si :

- le libellé en haut indique `Espace paiements clients`
- le menu latéral ne montre que `Tableau de bord` et `Clients`

Si vous voyez encore le menu complet (`Devis`, `Factures`, `Produits`, `Site web`, `Messagerie`, `Paramètres`, etc.), vous êtes dans un compte `FULL_APP`, pas dans le compte "Paiements clients".

## 2. Comment accéder à la fonctionnalité

### Accès propriétaire/admin

1. Ouvrez `/connexion`.
2. Connectez-vous avec l'adresse e-mail du propriétaire ou d'un collaborateur rattaché au compte.
3. Après connexion, vous arrivez sur `/tableau-de-bord`.
4. Ouvrez ensuite `/clients` pour accéder aux dossiers clients.

### Parcours de base

1. `Tableau de bord` pour la vue globale.
2. `Clients` pour la liste des clients.
3. Ouvrez un client.
4. Gérez dans son dossier :
   - les services liés
   - les paiements
   - les reçus
   - le rapport de période
   - les collaborateurs du compte si vous avez le droit

## 3. Comment créer un compte "Paiements clients"

### Situation actuelle

La création de ce type de compte n'est pas encore disponible en libre-service dans l'interface.

Aujourd'hui, il faut une intervention technique/interne pour préparer le compte.

### Processus actuel

1. Un administrateur technique doit créer ou configurer le compte avec le type `CLIENT_PAYMENTS`.
2. Le propriétaire du compte doit être membre de ce compte avec le rôle `OWNER`.
3. Le propriétaire se connecte ensuite normalement via `/connexion`.
4. L'application charge alors l'espace simplifié "Paiements clients".

### Point important

Un utilisateur existant possède déjà un compte personnel par défaut dans le système. Le nouveau mode repose sur le compte actif, pas sur une catégorie spéciale d'utilisateur.

## 4. Comment inviter des collaborateurs

### Condition

Il faut avoir la permission `Gérer les collaborateurs`.

### Où se trouve l'invitation

La gestion des collaborateurs se trouve dans le dossier d'un client, dans le bloc `Collaborateurs du compte`.

### Étapes

1. Ouvrez `Clients`.
2. Ouvrez n'importe quel dossier client.
3. Descendez jusqu'à `Collaborateurs du compte`.
4. Saisissez l'e-mail du collaborateur.
5. Choisissez son rôle :
   - `Membre`
   - `Admin`
6. Cochez les permissions à donner.
7. Cliquez sur `Envoyer l’invitation`.

### Comportement actuel de l'invitation

L'invitation est bien enregistrée dans l'application et apparaît dans `Invitations en attente`.

En revanche, dans l'état actuel :

- l'application n'envoie pas automatiquement un e-mail d'invitation
- l'interface n'affiche pas non plus le lien/token d'invitation à copier

En pratique, cela veut dire qu'une étape technique/interne est encore nécessaire pour transmettre le lien d'acceptation au collaborateur.

### Lien d'acceptation

Quand le token d'invitation est disponible :

- un utilisateur déjà existant doit passer par `/connexion?invitation=TOKEN`
- un nouvel utilisateur doit passer par `/inscription?invitation=TOKEN`

Si la personne est déjà connectée et ouvre un lien d'invitation valide, l'invitation est acceptée automatiquement et la session bascule sur le compte invité.

## 5. Comment fonctionnent les permissions

## Rôles

- `OWNER` : accès complet sur ce compte
- `ADMIN` : accès complet sur ce compte
- `MEMBER` : accès seulement aux permissions cochées à l'invitation

## Permissions disponibles

- `Voir le tableau de bord` : accès au tableau de bord du compte
- `Voir les clients` : accès à la liste des clients et aux dossiers clients
- `Gérer les clients` : créer, modifier, supprimer les clients et voir les notes internes client
- `Gérer les services` : créer, modifier, supprimer les services et voir/modifier les notes privées des services
- `Gérer les paiements` : enregistrer et supprimer des paiements, voir les notes privées des paiements
- `Gérer les reçus` : télécharger et envoyer les reçus
- `Voir les rapports` : voir les rapports de période sur le tableau de bord et dans le dossier client
- `Gérer les collaborateurs` : inviter des collaborateurs et voir les accès existants/en attente

## Règles utiles

- Pour un `MEMBER`, au moins une permission doit être sélectionnée.
- Si vous accordez une permission de gestion liée au dossier client, l'accès `Voir les clients` est ajouté automatiquement.
- Les restrictions ci-dessus s'appliquent au compte `CLIENT_PAYMENTS`.
- Les comptes `FULL_APP` gardent leur comportement complet actuel.

## 6. Gérer les clients

### Depuis la page `Clients`

Vous pouvez :

1. rechercher un client
2. filtrer par statut `Actifs` / `Inactifs`
3. exporter la liste en CSV
4. créer un client si vous avez `Gérer les clients`
5. modifier ou supprimer un client si vous avez `Gérer les clients`
6. ouvrir le dossier d'un client

### Suppression d'un client

La suppression est bloquée si le client possède encore :

- des devis
- des factures
- des services liés
- des paiements enregistrés

Cela protège l'historique existant et évite de casser les liens de données.

## 7. Gérer les services d'un client

Tout se fait dans le dossier client, section `Services liés`.

### Avec la permission `Gérer les services`

Vous pouvez :

1. ajouter un service
2. modifier un service existant
3. définir son statut `Actif` ou `Inactif`
4. renseigner :
   - `Titre`
   - `Détails`
   - `Notes`
   - `Notes privées`
5. supprimer un service

### Sans cette permission

Vous pouvez seulement consulter :

- le titre
- les détails
- les notes normales

Les notes privées de service ne sont pas affichées.

## 8. Gérer les paiements et les reçus

Tout se fait dans le dossier client, section `Paiements & reçus`.

### Enregistrer un paiement

Avec la permission `Gérer les paiements` :

1. ouvrez le bloc `Enregistrer le paiement`
2. renseignez :
   - la date
   - le montant
   - le mode de paiement
   - la référence
   - la description
   - la note
   - la note privée
3. liez le paiement à un ou plusieurs services si nécessaire
4. cliquez sur `Enregistrer le paiement`

Le paiement apparaît ensuite dans l'historique du client.

### Historique de paiement

Chaque paiement conserve :

- le montant
- la date
- la référence
- les notes visibles
- les éventuels services liés
- l'état du reçu

La note privée d'un paiement n'est visible qu'avec `Gérer les paiements`.

### Télécharger un reçu

Avec la permission `Gérer les reçus` :

1. ouvrez un paiement dans l'historique
2. cliquez sur `Télécharger le reçu`

Le reçu PDF est généré automatiquement s'il n'existe pas encore.

### Envoyer un reçu par e-mail

Avec la permission `Gérer les reçus` :

1. ouvrez le paiement concerné
2. saisissez ou vérifiez l'adresse e-mail du destinataire
3. ajustez l'objet si besoin
4. cliquez sur `Envoyer le reçu`

L'envoi part en arrière-plan.

### Important sur les reçus

- Le reçu est créé au premier téléchargement ou au premier envoi.
- Une fois créé, il repose sur un instantané figé des données.
- Si vous modifiez plus tard le client, les services ou les réglages société, les anciens reçus ne changent pas.

## 9. Voir le tableau de bord et les rapports

## Tableau de bord

Le tableau de bord du compte "Paiements clients" affiche :

- le total encaissé sur la période
- le nombre de paiements enregistrés
- le nombre de reçus émis
- le nombre de clients actifs
- un graphique d'historique
- une liste de paiements récents

### Filtrer la période

1. ouvrez `Tableau de bord`
2. choisissez `Du` et `Au`
3. appliquez le filtre

### Rapport global

Avec la permission `Voir les rapports`, le tableau de bord affiche aussi un rapport client global sur la période choisie.

Sans cette permission, le tableau de bord reste accessible, mais le détail du rapport n'est pas affiché.

## Rapport dans le dossier client

Chaque dossier client contient son propre bloc `Rapport période client`.

1. choisissez `Du` et `Au`
2. cliquez sur `Filtrer`
3. consultez :
   - le total de la période
   - le nombre de paiements
   - le nombre de reçus

Il n'existe pas de section `Rapports` séparée : les rapports sont intégrés au tableau de bord et au dossier client.

## 10. Limitations et comportements importants à connaître

- La création ou conversion en compte `CLIENT_PAYMENTS` n'est pas encore faisable depuis l'interface.
- L'invitation collaborateur n'envoie pas encore l'e-mail automatiquement et n'affiche pas le lien/token dans l'UI.
- Il n'existe pas encore de sélecteur de compte dans l'interface pour passer d'un compte accessible à un autre.
- Après une reconnexion classique, un collaborateur peut ne pas revenir automatiquement dans le compte invité sans changement explicite du compte actif.
- Le compte "Paiements clients" ne donne pas accès à `Devis`, `Factures`, `Produits`, `Site web`, `Messagerie`, `Assistant` ou `Paramètres`.
- L'envoi de reçus par e-mail dépend d'une configuration SMTP déjà en place.
- Comme l'espace simplifié n'a pas de page `Paramètres` ou `Messagerie`, cette configuration doit être préparée ailleurs.
- Si les réglages société ne sont pas encore configurés, les reçus peuvent partir avec des informations société par défaut.
- La suppression d'un paiement est définitive dans l'état actuel. Il n'y a pas de corbeille ni d'annulation.
- La suppression d'un service est aussi définitive.
- Le formulaire de paiement permet de lier plusieurs services, mais ne permet pas encore de répartir le montant par service dans l'interface.
- Le dossier client affiche aussi le nombre de devis et de factures existants, mais cette partie reste surtout informative dans le mode "Paiements clients".

## 11. Parcours recommandé pour un admin non technique

1. Demandez d'abord à l'équipe technique d'activer ou créer votre compte en mode `CLIENT_PAYMENTS`.
2. Vérifiez les réglages société et SMTP avant usage réel des reçus.
3. Connectez-vous et confirmez que l'en-tête affiche `Espace paiements clients`.
4. Créez vos clients.
5. Ouvrez chaque dossier client pour ajouter les services utiles.
6. Enregistrez les paiements au fil de l'eau.
7. Téléchargez ou envoyez les reçus depuis chaque paiement.
8. Suivez la période globale depuis `Tableau de bord`.
9. Utilisez le bloc `Collaborateurs du compte` si vous devez déléguer une partie de la gestion.
