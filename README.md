## Développement

1. Installez les dépendances :

   ```bash
   npm install
   ```

2. Copiez `.env.example` vers `.env` et renseignez les secrets requis (PostgreSQL, SMTP, cookies, URLs). Si vous déployez sur Vercel, ajoutez également `PRISMA_ACCELERATE_URL` (clé Prisma Accelerate/Data Proxy) pour que les fonctions serverless réutilisent des connexions persistantes au lieu d'ouvrir un socket PostgreSQL à chaque requête.

3. Lancez le serveur de développement :

   ```bash
   npm run dev
   ```

4. Ouvrez `http://localhost:3000`.

Consultez `DEPLOY.md` pour les instructions de mise en production sur Vercel.
Le build déclenché par Vercel (`npm run vercel-build`) s’appuie sur `scripts/run-vercel-build.cjs`, qui exécute `prisma generate`, tente `prisma migrate deploy` puis `next build`, en sautant automatiquement l’étape migration si la base est momentanément injoignable (voir le détail dans `DEPLOY.md`).

## Tests

Vitest n’utilise plus la base production : créez une base PostgreSQL locale (Docker, Supabase local ou cluster de dev) et exposez-la via `TEST_DATABASE_URL`.

1. Copiez `.env.example` vers `.env.test`, renseignez `TEST_DATABASE_URL`, `DIRECT_URL` et `SHADOW_DATABASE_URL` vers votre instance locale :
   ```bash
   cp .env.example .env.test
   # Exemple Docker
   docker run --name invoices-db-test -p 6543:5432 -e POSTGRES_PASSWORD=postgres -d postgres:16
   ```
2. Exécutez les migrations sur cette base :
   ```bash
   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:6543/invoices_test" \
   npx prisma migrate deploy
   ```
3. Lancez les tests :
   ```bash
   npm test
   ```

Le fichier `tests/setup-test-env.ts` charge automatiquement `.env.test` et remplace la connexion Prisma par la base déclarée. Sans `TEST_DATABASE_URL`, la suite échoue immédiatement pour éviter toute connexion accidentelle à la production.

#### Messagerie toujours active (auto-réponses + envois planifiés)

Les réponses automatiques (SLA 24h et mode vacances) et les e-mails planifiés passent désormais par une file de jobs persistante (`BackgroundJob`). Le workflow GitHub Actions `.github/workflows/messaging-cron.yml` (gratuit) appelle `/api/cron/messaging` toutes les 5 minutes, ce qui :

- alimente la file (`messaging.dispatchScheduledEmails`, `messaging.syncInboxAutoReplies`);
- exécute les jobs en appliquant l’exponential backoff + la déduplication (un job par utilisateur et par créneau);
- expose les métriques via `/api/jobs/metrics` (voir Observability ci-dessous).

En local, aucun Cron externe n’existe : appelez simplement `curl http://localhost:3000/api/cron/messaging` pendant que `npm run dev` tourne (le token n’est pas requis si `CRON_SECRET_TOKEN` n’est pas défini). En production, définissez `CRON_SECRET_TOKEN`, exposez `CRON_ENDPOINT=https://invoice-app.../api/cron/messaging` en secret GitHub et laissez GitHub Actions (ou n’importe quel scheduler HTTP gratuit, type UptimeRobot) frapper l’URL avec `Authorization: Bearer <token>`.

#### Observabilité & alertes jobs

- `GET /api/jobs/metrics?token=<CRON_SECRET_TOKEN>` retourne : totaux par statut, prochains jobs planifiés et les 20 derniers événements (`ENQUEUED`, `STARTED`, `SUCCEEDED`, `RETRY_SCHEDULED`, `FAILED`, `DEDUPED`). Pratique pour brancher un dashboard ou vérifier la saturation de la file.
- `console.info` journalise chaque tick Cron (`[cron] Messagerie …`) et `console.warn`/`console.error` remontent les tentatives échouées dans les logs Vercel (et dans les logs GitHub Actions lors des appels `curl`).
- Définissez `JOBS_ALERT_WEBHOOK_URL` pour recevoir un POST JSON lorsque qu’un job passe définitivement en `FAILED` après tous les retries (exponential backoff jusqu’à 1h). Cela peut pointer vers Slack, Teams, etc.

### Migration SQLite → Supabase Postgres

Un snapshot SQLite (`prisma/prisma/dev.db`) subsiste pour les anciennes données de démonstration. Pour le migrer vers Supabase :

1. Exportez vos identifiants Supabase dans l’environnement local :
   ```bash
   export DATABASE_URL="postgresql://"
   export DIRECT_URL="$DATABASE_URL"
   export SHADOW_DATABASE_URL="$DATABASE_URL&schema=shadow"
   ```
2. Provisionnez le schéma Postgres (nécessite l’accès réseau) :
   ```bash
   npx prisma migrate deploy
   ```
3. Copiez les données SQLite → Postgres en gardant une sauvegarde du fichier `prisma/prisma/dev.db` :
   ```bash
   SQLITE_URL="file:./prisma/prisma/dev.db" \
   POSTGRES_URL="$DATABASE_URL" \
   npm run db:migrate:sqlite-to-postgres
   ```
   Le script (appuyé sur le binaire `sqlite3`) vérifie que la base cible est vide, puis affiche le nombre de lignes copiées par table.
4. Vérifiez les comptes via Prisma ou `psql` :
   ```bash
   npx prisma db pull  # optionnel pour confirmer la connexion
   psql "$DATABASE_URL" -c '\\dt'
   ```

Gardez le snapshot SQLite en lecture seule après migration ; il peut servir de référence/backup.

### Suivi des e-mails en local (ngrok)

Les pixels d'ouverture et liens de suivi doivent être accessibles via une URL HTTPS publique. En développement :

1. Installez [ngrok](https://ngrok.com/download) (ou équivalent).
2. Exposez votre instance locale :
   ```bash
   ngrok http 3000
   ```
3. Relevez l'URL HTTPS fournie (ex. `https://acme.ngrok.app`) et définissez-la dans `.env` :
   ```
   NEXT_PUBLIC_APP_URL=https://acme.ngrok.app
   ```
4. Redémarrez le serveur (`npm run dev`). Les e-mails envoyés depuis Messagerie ou Factures embarqueront les pixels/liens pointant vers cette URL publique.

### Site web public & catalogue

- Configurez le contenu dans **Site web** (nouvel item du menu). Le formulaire vous permet de personnaliser le héro, les blocs “À propos”/contact, la couleur d’accent, les champs SEO et le message de remerciement du formulaire de contact.
- Sélectionnez un template visuel (actuellement “Dev Agency”) pour adapter la mise en page. Les prochains modèles (architecte, école IT…) arriveront progressivement.
- Utilisez `/preview` (bouton “Prévisualiser”) pour valider la mise en page en développement : cette route est réservée aux utilisateurs authentifiés et n’enregistre pas les leads.
- Pour rendre vos produits visibles, activez l’option **Catalogue public** dans chaque fiche produit. Le panneau récapitulatif de la page Site web indique combien d’items sont publiés.
- Par défaut, votre site est accessible via `APP_URL/catalogue/<slug>`. Définissez `APP_HOSTNAMES` (liste de domaines réservés à l’application) et `CATALOG_EDGE_DOMAIN` (cible CNAME) dans `.env` pour activer l’hébergement multi-domaine.
- Configurez également `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` (et `VERCEL_TEAM_ID` si vous travaillez dans une Team) pour que l’activation puisse enregistrer automatiquement chaque domaine auprès de Vercel et éviter les erreurs `DEPLOYMENT_NOT_FOUND`.
- Lier un domaine :
  1. Ajoutez votre domaine dans le formulaire “Domaine personnalisé”.
  2. Créez un CNAME vers `CATALOG_EDGE_DOMAIN`.
  3. Ajoutez un TXT `verification=<domainVerificationCode>` sur `_verification.<votre-domaine>` (ex. `_verification.www.exemple.com`). Ce sous-domaine dédié évite le conflit CNAME + TXT.
  4. Cliquez sur **Vérifier** : l’application contrôle les enregistrements TXT/CNAME et bloque la progression tant qu’ils ne sont pas corrects.
  5. Cliquez sur **Activer** : le domaine est rattaché au projet Vercel avant de passer en statut _Active_, ce qui évite les 404 `DEPLOYMENT_NOT_FOUND`.
- Flux de données : chaque soumission du formulaire (nom, email, téléphone, besoin) crée un client `source=WEBSITE_LEAD` dans l’onglet Clients, avec les besoins en note et les métadonnées (domaine, chemin, IP). Une notification e-mail est envoyée à l’adresse configurée et le formulaire applique une protection anti-spam (honeypot, détection de liens/anomalies, anti double soumission).
