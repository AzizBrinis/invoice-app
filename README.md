## Développement

1. Installez les dépendances :

   ```bash
   npm install
   ```

2. Copiez `.env.example` vers `.env` et renseignez les secrets requis (PostgreSQL/Supabase, SMTP, cookies, URLs). Le runtime applicatif utilise directement PostgreSQL via Supabase : `DATABASE_URL` sert au runtime, `DIRECT_URL` reste recommandé pour les scripts/ops, et `DB_RUNTIME_URL_MODE` permet de forcer `database` ou `direct` si nécessaire.

3. Lancez le serveur de développement :

   ```bash
   npm run dev
   ```

4. Ouvrez `http://localhost:3000`.

Consultez `DEPLOY.md` pour les instructions de mise en production sur Vercel.
Le build déclenché par Vercel (`npm run vercel-build`) lance simplement `next build --webpack` avec la couche SQL directe déjà configurée.

### Import CSV clients

- La section **Clients** propose un import CSV avec un modèle téléchargeable directement depuis l’interface.
- Colonnes reconnues : `Nom`, `Société`, `E-mail`, `Téléphone`, `TVA`, `Adresse`, `Statut`, `Notes`.
- L’import reste scoped au compte actif. Les lignes sont créées, mises à jour ou ignorées selon les doublons détectés (priorité à l’e-mail, puis à la TVA, puis aux correspondances exactes nom + société / téléphone).
- Les champs vides n’écrasent pas les données existantes lors d’une mise à jour, et un résumé signale les lignes ignorées ou invalides.

### Base PostgreSQL locale via Docker

Si vous n’avez pas accès au cluster Supabase (ou que le réseau est bloqué), vous pouvez utiliser la pile Docker fournie (`docker-compose.dev.yml`) pour lancer PostgreSQL + Mailpit en local :

1. Démarrez les services :
   ```bash
   npm run dev:stack:up
   ```
   - Postgres écoute sur `localhost:6543`.
   - Mailpit écoute sur `localhost:1025` (SMTP) et expose son interface web sur `http://localhost:8025`.
2. Copiez `.env.example` vers `.env` (ou `.env.local`) et remplacez les URLs par celles du Postgres local :
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:6543/invoices?sslmode=disable"
   DIRECT_URL="postgresql://postgres:postgres@localhost:6543/invoices?sslmode=disable"
   TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:6543/invoices_test?sslmode=disable"
   SMTP_HOST="localhost"
   SMTP_PORT="1025"
   SMTP_SECURE="false"
   ```
   Créez la base de tests une fois pour toutes :
   ```bash
   docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -c "CREATE DATABASE invoices_test;"
   ```
3. Assurez-vous que la base locale contient déjà le schéma applicatif courant (restauration d’un dump ou clone de votre base Supabase), puis générez des données de démo si besoin :
   ```bash
   npm run db:seed
   ```

Arrêtez la pile avec `npm run dev:stack:down` et suivez les logs via `npm run dev:stack:logs`.

## Tests

Vitest n’utilise plus la base production : créez une base PostgreSQL locale (Docker, Supabase local ou cluster de dev) et exposez-la via `TEST_DATABASE_URL`.

1. Copiez `.env.example` vers `.env.test`, renseignez `TEST_DATABASE_URL` et `DIRECT_URL` vers votre instance locale :
   ```bash
   cp .env.example .env.test
   # Exemple Docker
   docker run --name invoices-db-test -p 6543:5432 -e POSTGRES_PASSWORD=postgres -d postgres:16
   ```
2. Vérifiez que la base de test possède déjà le schéma applicatif courant, puis lancez les tests :
   ```bash
   npm test
   ```

Le fichier `tests/setup-test-env.ts` charge automatiquement `.env.test` et redirige toutes les connexions vers la base déclarée. Sans `TEST_DATABASE_URL`, la suite échoue immédiatement pour éviter toute connexion accidentelle à la production.

#### Messagerie toujours active (auto-réponses + envois planifiés + sync locale)

Les réponses automatiques (SLA 24h et mode vacances), les e-mails planifiés et la synchronisation locale IMAP passent par une file de jobs persistante (`BackgroundJob`). Deux workflows GitHub Actions gratuits appellent `/api/cron/messaging` toutes les 5 minutes :

- `.github/workflows/messaging-cron.yml` avec `scope=email` alimente les jobs `messaging.dispatchScheduledEmails`, `messaging.syncInboxAutoReplies` et les envois de documents;
- `.github/workflows/messaging-local-sync.yml` avec `scope=local-sync` alimente les jobs `messaging.localSync*`;
- exécute les jobs en appliquant l’exponential backoff + la déduplication (un job par utilisateur et par créneau);
- expose les métriques via `/api/jobs/metrics` (voir Observability ci-dessous).

En local, aucun Cron externe n’existe : appelez simplement `curl "http://localhost:3000/api/cron/messaging?scope=email"` ou `curl "http://localhost:3000/api/cron/messaging?scope=local-sync"` pendant que `npm run dev` tourne (le token n’est pas requis si `CRON_SECRET_TOKEN` n’est pas défini). En production, définissez `CRON_SECRET_TOKEN`, exposez `CRON_ENDPOINT=https://invoice-app.../api/cron/messaging` en secret GitHub et laissez les workflows GitHub Actions frapper l’URL avec `Authorization: Bearer <token>`.

#### Observabilité & alertes jobs

- `GET /api/jobs/metrics?token=<CRON_SECRET_TOKEN>` retourne : totaux par statut, prochains jobs planifiés et les 20 derniers événements (`ENQUEUED`, `STARTED`, `SUCCEEDED`, `RETRY_SCHEDULED`, `FAILED`, `DEDUPED`). Pratique pour brancher un dashboard ou vérifier la saturation de la file.
- `console.info` journalise chaque tick Cron (`[cron] Messagerie …`) et `console.warn`/`console.error` remontent les tentatives échouées dans les logs Vercel (et dans les logs GitHub Actions lors des appels `curl`).
- Définissez `JOBS_ALERT_WEBHOOK_URL` pour recevoir un POST JSON lorsque qu’un job passe définitivement en `FAILED` après tous les retries (exponential backoff jusqu’à 1h). Cela peut pointer vers Slack, Teams, etc.

### Migration SQLite → Supabase Postgres

Un snapshot SQLite (`backups/legacy-sqlite/dev.db`) subsiste pour les anciennes données de démonstration. Pour le migrer vers Supabase :

1. Exportez vos identifiants Supabase dans l’environnement local :
   ```bash
   export DATABASE_URL="postgresql://"
   export DIRECT_URL="$DATABASE_URL"
   ```
2. Assurez-vous que la base PostgreSQL cible contient déjà le schéma applicatif courant (restauration de backup, clone Supabase, base de staging existante, etc.).
3. Copiez les données SQLite → Postgres en gardant une sauvegarde du fichier `backups/legacy-sqlite/dev.db` :
   ```bash
   SQLITE_URL="file:./backups/legacy-sqlite/dev.db" \
   POSTGRES_URL="$DATABASE_URL" \
   npm run db:migrate:sqlite-to-postgres
   ```
   Le script (appuyé sur le binaire `sqlite3`) vérifie que la base cible est vide, puis affiche le nombre de lignes copiées par table.
4. Vérifiez les comptes via `psql` :
   ```bash
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
