# Domaine personnalisé

## Vue d’ensemble

La fonctionnalité `Domaine personnalisé` rattache le site public/catalogue d’un tenant à un hostname externe, tout en gardant l’interface applicative sur les hostnames déclarés comme `app hosts`.

Flux réel actuel :

1. L’admin enregistre un domaine dans **Site web > Domaine personnalisé**.
2. L’application stocke ce domaine dans `WebsiteConfig.customDomain`, passe le statut à `PENDING` et dépublie le site.
3. L’admin ajoute les enregistrements DNS demandés.
4. Le bouton **Vérifier** contrôle le TXT de vérification et le CNAME via DNS.
5. Le bouton **Activer** ajoute le domaine au projet Vercel, déclenche la vérification Vercel, puis passe le site en `ACTIVE` et `published=true`.
6. En production, le middleware réécrit toute requête reçue sur un hostname non applicatif vers `/catalogue?domain=<host>`.

Le domaine n’est servi que si :

- `WebsiteConfig.customDomain` correspond exactement au `Host` reçu
- `WebsiteConfig.domainStatus === ACTIVE`
- `WebsiteConfig.published === true`

## Architecture réelle

### Modèle de données

Le domaine personnalisé est stocké dans `WebsiteConfig` :

- `slug`: fallback public interne sous `/catalogue/<slug>`
- `customDomain`: hostname personnalisé, unique, nullable
- `domainStatus`: `PENDING | VERIFIED | ACTIVE`
- `domainVerificationCode`: code unique généré côté DB
- `domainVerifiedAt`: timestamp de succès DNS
- `domainActivatedAt`: timestamp d’activation Vercel
- `published`: indique si le site public doit être servi

Contraintes observées :

- un seul `WebsiteConfig` par tenant/utilisateur
- un seul domaine personnalisé par site
- aucun support de wildcard en base ou en résolution
- aucune table de mapping multi-domaines

### Résolution de domaine et routing

Le middleware (`middleware.ts`) :

- considère comme hostnames applicatifs ceux issus de `APP_URL`, `NEXT_PUBLIC_APP_URL`, `APP_HOSTNAMES`, `VERCEL_URL`, `localhost:3000` et `127.0.0.1:3000`
- laisse passer les requêtes `/_next`, `/api`, `/static`, `favicon.ico`, `robots.txt`, `sitemap.xml` et les chemins statiques
- réécrit tout autre host vers `/catalogue...`
- injecte `domain=<hostname normalisé>`
- injecte aussi `path=<pathname d’origine>` pour préserver la route logique

Le catalogue (`src/app/catalogue/[[...segments]]/page.tsx`) :

- résout d’abord le domaine si `searchParams.domain` est présent
- retombe sur le `slug` seulement sur les URLs applicatives
- reconstruit la route logique réelle à partir de `path`

Le chargement de site (`loadCatalogWebsite` dans `src/server/website.ts`) :

- cherche `customDomain = <host>`
- exige `domainStatus = ACTIVE`
- refuse le site si `published = false`

### Flow admin

#### 1. Enregistrement du domaine

Action : `requestCustomDomain()`

Comportement actuel :

- normalise le domaine en minuscules
- refuse le domaine si un autre tenant l’utilise déjà
- si le domaine soumis est identique à l’existant, ne modifie plus rien
- si le domaine change, retire l’ancien domaine du projet Vercel en best effort
- stocke le nouveau domaine
- remet le statut à `PENDING`
- efface `domainVerifiedAt` et `domainActivatedAt`
- dépublie le site

#### 2. Vérification DNS

Action : `verifyCustomDomain()`

Contrôles effectués :

- TXT `verification=<domainVerificationCode>` sur `_verification.<domaine>`
- fallback legacy accepté : TXT identique sur le host racine du domaine
- CNAME du domaine vers `CATALOG_EDGE_DOMAIN`

Si tout est correct :

- `domainStatus` passe à `VERIFIED`
- `domainVerifiedAt` est rempli

#### 3. Activation Vercel

Action : `activateCustomDomain()`

Comportement actuel :

- refuse l’activation si le domaine n’a pas été vérifié
- ajoute le domaine au projet Vercel via l’API projet
- si Vercel renvoie `verified=false`, lance aussi la vérification Vercel
- n’active plus le site tant que Vercel ne confirme pas le domaine comme utilisable
- passe ensuite `domainStatus` à `ACTIVE`
- remplit `domainActivatedAt`
- remet `published = true`

#### 4. Déconnexion

Action : `disconnectCustomDomain()`

Comportement :

- retire le domaine du projet Vercel en best effort
- vide `customDomain`
- remet le statut à `PENDING`
- efface les timestamps de vérification/activation
- dépublie le site

Important :

- la déconnexion dépublie aussi l’URL slug `/catalogue/<slug>`
- c’est le comportement actuel du produit, pas seulement du domaine personnalisé

## DNS requis

### Support réellement implémenté

Le flux actuel supporte uniquement les **sous-domaines**.

Exemples supportés :

- `www.exemple.com`
- `shop.exemple.com`

Exemples non supportés par le code actuel :

- `exemple.com` (apex/root domain)
- `*.exemple.com` (wildcard)

### Enregistrements à créer

Pour `www.exemple.com` :

1. CNAME
   - Host: `www`
   - Target: valeur de `CATALOG_EDGE_DOMAIN`
2. TXT de vérification
   - Host: `_verification.www`
   - Value: `verification=<domainVerificationCode>`

Le TXT dédié sous `_verification` évite le conflit DNS classique entre TXT et CNAME sur le même host.

### Pourquoi l’apex n’est pas supporté aujourd’hui

Le code vérifie explicitement un **CNAME** sur `customDomain`.

Conséquences :

- `example.com` échouera à la vérification DNS dans le flux actuel
- aucune résolution `A`, `ALIAS` ou `ANAME` n’est implémentée
- aucune UX dédiée n’explique un mode apex alternatif

Vercel supporte pourtant les domaines apex avec un enregistrement `A`, mais ce projet ne l’implémente pas encore dans son flow applicatif. Voir la doc officielle Vercel : [Adding & Configuring a Custom Domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)

## Configuration Vercel

Variables attendues par le code :

- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN` ou `VERCEL_ACCESS_TOKEN` ou `VERCEL_AUTH_TOKEN`
- `VERCEL_TEAM_ID` si le projet appartient à une team
- `CATALOG_EDGE_DOMAIN`

Le code actuel :

- rattache le domaine au **projet Vercel**
- n’assigne pas explicitement le domaine à un environnement Vercel spécifique
- n’ajoute pas de redirection apex/www
- ne gère pas les wildcards

Conséquence opérationnelle :

- si vous avez besoin d’un domaine limité à un environnement précis, il faut un complément produit/infra
- le flow actuel suppose un domaine projet standard, partagé par le déploiement de production attendu

Référence officielle : [Assigning a custom domain to an environment](https://vercel.com/docs/domains/working-with-domains/add-a-domain-to-environment)

## Processus de mise en place

### Pré-requis

1. Déployer l’application sur Vercel.
2. Définir :
   - `APP_URL`
   - `NEXT_PUBLIC_APP_URL`
   - `APP_HOSTNAMES`
   - `CATALOG_EDGE_DOMAIN`
   - `VERCEL_PROJECT_ID`
   - `VERCEL_TOKEN`
   - `VERCEL_TEAM_ID` si nécessaire
3. Vérifier que `APP_HOSTNAMES` contient seulement les hostnames de l’interface applicative.
4. Choisir un sous-domaine public distinct, par exemple `www.exemple.com`.

### Étapes opérateur

1. Ouvrir **Site web** dans l’admin.
2. Saisir le sous-domaine dans **Domaine personnalisé**.
3. Enregistrer.
4. Créer le CNAME vers `CATALOG_EDGE_DOMAIN`.
5. Créer le TXT `_verification.<host>` avec `verification=<code>`.
6. Attendre la propagation DNS.
7. Cliquer sur **Vérifier**.
8. Si la vérification DNS réussit, cliquer sur **Activer**.
9. Contrôler ensuite :
   - `https://<domaine>`
   - `https://<domaine>/robots.txt`
   - `https://<domaine>/sitemap.xml`
   - le certificat TLS
   - les liens internes du site

### Vérification post-activation

À contrôler après activation :

- la page d’accueil répond sur le domaine personnalisé
- les routes internes restent root-relative sur le domaine personnalisé
- les formulaires publics fonctionnent
- les appels `/api/catalogue/*` répondent depuis le même host
- les emails de confirmation de commande utilisent le domaine personnalisé quand le site est `ACTIVE`

## Comment le routage fonctionne

### URL slug

Toujours disponible côté application tant que le site est publié :

- `https://<app-host>/catalogue/<slug>`

### Domaine personnalisé

Quand le domaine est `ACTIVE`, les requêtes reçues sur ce host sont servies comme site public :

- `https://www.exemple.com/`
- `https://www.exemple.com/about`
- `https://www.exemple.com/contact`

### Comportement corrigé

Les templates publics utilisaient auparavant encore des liens `/catalogue/<slug>/...` même sur domaine personnalisé actif.

Correctif appliqué :

- sur domaine personnalisé `ACTIVE`, les liens publics générés restent désormais root-relative
- sur l’URL slug, les liens restent `/catalogue/<slug>/...`
- en preview, les liens continuent à utiliser `/preview?path=...`

## Auth, session, cookies et redirections

### Interface admin

L’auth back-office utilise le cookie `session_token` :

- cookie httpOnly
- `SameSite=Strict`
- sans attribut `Domain`
- scope `path=/`

Conséquence :

- la session admin est liée au host courant
- elle n’est pas partagée entre hostnames différents

### Espace client public

L’auth client du catalogue n’utilise pas Supabase Auth. Elle utilise la table `ClientSession` et le cookie `client_session_token`.

Caractéristiques :

- cookie httpOnly
- `SameSite=Strict`
- sans attribut `Domain`
- lié au host courant

Conséquences :

- un client connecté sur `www.exemple.com` n’est pas connecté automatiquement sur `/catalogue/<slug>` côté domaine applicatif
- l’inverse est également vrai
- c’est cohérent avec la sécurité actuelle, mais il faut l’assumer dans les opérations et le support

### Résolution tenant côté API

Les routes `/api/catalogue/*` :

- utilisent le `Host` pour retrouver le site quand la requête arrive sur un domaine personnalisé
- utilisent `?slug=` seulement sur les hostnames applicatifs

Le cookie de session client fonctionne donc naturellement sur domaine personnalisé tant que le navigateur reste sur le même host.

### Supabase

État actuel :

- aucune dépendance directe à Supabase Auth pour ce flow de domaine personnalisé
- pas de configuration Supabase obligatoire aujourd’hui pour les sessions catalogue/admin

Si vous ajoutez plus tard de l’OAuth ou des redirects Supabase sur le domaine personnalisé :

- ajoutez les URLs de production exactes dans la allowlist de redirect
- ajoutez aussi les URLs de preview/dev nécessaires

Référence : [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## SSL et certificats

Le code délègue complètement les certificats à Vercel.

Ce que fait l’application :

- ajout du domaine au projet Vercel
- tentative de vérification Vercel avant activation applicative

Ce que l’application ne fait pas :

- polling de l’état du certificat après activation
- affichage détaillé de l’état SSL côté admin
- diagnostic automatique des erreurs TLS

Recommandation opérateur :

- après activation, valider manuellement le certificat dans le dashboard Vercel
- ne pas annoncer le domaine comme prêt tant que HTTPS n’est pas confirmé navigateur + Vercel

## Erreurs fréquentes et troubleshooting

### `TXT_NOT_FOUND`

Cause probable :

- le TXT n’existe pas sur `_verification.<domaine>`
- propagation DNS incomplète

Action :

- vérifier le host exact
- vérifier la valeur exacte `verification=<code>`
- attendre la propagation

### `TXT_MISMATCH`

Cause probable :

- le TXT existe mais ne contient pas le bon code

Action :

- remplacer la valeur par le code affiché dans l’admin

### `CNAME_NOT_FOUND`

Cause probable :

- aucun CNAME présent sur le sous-domaine

Action :

- ajouter le CNAME vers `CATALOG_EDGE_DOMAIN`

### `CNAME_MISMATCH`

Cause probable :

- le CNAME pointe vers une autre cible

Action :

- corriger la cible vers la valeur exacte affichée dans l’admin

### `Vercel a refusé le domaine`

Cause probable :

- token ou project ID invalides
- domaine déjà rattaché ailleurs
- Vercel attend encore sa propre vérification

Action :

- vérifier `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`
- vérifier le dashboard Vercel > Domains
- relancer l’activation après propagation complète

### Le domaine répond en 404

Causes probables :

- domaine ajouté chez Vercel mais site non `ACTIVE`
- `published=false`
- host non trouvé en base

Action :

- vérifier `customDomain`, `domainStatus`, `published`
- vérifier que le domaine stocké correspond exactement au host reçu

### Le site n’est plus visible après changement de domaine

Comportement normal actuel :

- tout changement de domaine remet le flow à `PENDING`
- le site est dépublié jusqu’à re-vérification + réactivation

## Limites et caveats connus

### Support fonctionnel

- apex/root domain non pris en charge
- wildcard non pris en charge
- un seul domaine par site
- matching strict sur un seul hostname exact
- pas de redirect automatique `apex -> www` ou `www -> apex`

### Produit / UX

- pas de polling automatique de propagation DNS
- pas de bouton “recheck Vercel status”
- pas d’affichage détaillé des challenges Vercel restants
- la déconnexion dépublie aussi le site slug

### Infra / déploiement

- pas d’assignation explicite à un environnement Vercel spécifique
- dépendance forte à `CATALOG_EDGE_DOMAIN`
- le flow suppose une configuration correcte des `app hosts`

## Audit synthétique

### Ce qui fonctionne bien

- mapping domaine -> site via middleware + résolution serveur
- séparation claire entre hostnames applicatifs et hostnames catalogue
- vérification DNS applicative avant activation
- usage du domaine actif dans les URLs canoniques, `robots`, `sitemap` et certains liens email

### Problèmes identifiés

1. Les templates publics conservaient des liens `/catalogue/<slug>` sur domaine personnalisé actif.
2. Réenregistrer le même domaine réinitialisait le statut et dépubliait le site.
3. Changer de domaine ne nettoyait pas l’ancien domaine Vercel.
4. L’activation applicative ne garantissait pas que Vercel avait réellement fini la vérification.
5. L’UI parlait d’un “domaine” générique alors que le flow réel n’accepte que les sous-domaines.
6. L’apex domain est implicitement non supporté mais n’était pas clairement signalé.

### Correctifs appliqués

1. Les templates publics utilisent maintenant des liens root-relative quand `customDomain` est `ACTIVE`.
2. Réenregistrer le même domaine devient un no-op côté serveur.
3. Changer de domaine tente maintenant de retirer l’ancien domaine du projet Vercel.
4. L’activation vérifie désormais aussi l’état Vercel avant de passer le site en `ACTIVE`.
5. L’UI admin a été clarifiée pour indiquer le support subdomain-only.
6. La route `contact-messages` normalise désormais le host comme les autres routes catalogue.

## Bonnes pratiques recommandées en production

1. Utiliser `www.<domaine>` comme domaine public principal, pas l’apex.
2. Garder l’interface applicative sur un hostname séparé, par exemple `app.<domaine>`.
3. Définir explicitement `APP_HOSTNAMES` pour éviter qu’un domaine catalogue soit traité comme hostname applicatif.
4. Vérifier le statut Vercel et le certificat TLS après chaque activation.
5. Tester les parcours critiques sur le domaine personnalisé :
   - navigation
   - login/signup client
   - checkout
   - contact
   - quote requests
   - emails de confirmation
6. Documenter côté support que les sessions client/admin ne sont pas partagées entre hosts différents.
7. Prévoir un runbook pour rollback :
   - déconnecter le domaine
   - republier via l’URL slug si nécessaire
   - corriger le DNS
   - réactiver ensuite

## Références externes

- Vercel custom domains : [Adding & Configuring a Custom Domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- Vercel API project domains : [Add a domain to a project](https://docs.vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project)
- Vercel environment domains : [Assigning a custom domain to an environment](https://vercel.com/docs/domains/working-with-domains/add-a-domain-to-environment)
- Supabase redirect allowlist : [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
