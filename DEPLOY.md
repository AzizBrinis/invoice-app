## Déploiement sur Vercel

Cette application tourne sur Vercel avec Next.js 16 et une connexion PostgreSQL directe vers Supabase via le package `postgres`.

Le build Vercel déclenche `npm run vercel-build`, qui exécute simplement :

1. `next build --webpack`

Le build ne modifie jamais le schéma de base de données. Toute évolution SQL doit être appliquée en dehors du build, via votre workflow Supabase/SQL habituel.

### Variables d’environnement à configurer sur Vercel

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Chaîne PostgreSQL principale utilisée au runtime. Le transaction pooler Supabase (`:6543` avec `pgbouncer=true`) est supporté. |
| `DIRECT_URL` | URL session pooler/directe recommandée pour les scripts d’administration, seeds et opérations longues. |
| `DB_RUNTIME_URL_MODE` | (Optionnel) `auto` (défaut), `database` ou `direct` pour forcer la source utilisée au runtime. |
| `DB_MAX_CONNECTIONS` | (Optionnel) Taille max du pool SQL applicatif. La valeur par défaut reste conservative (`1`) pour les runtimes serverless. |
| `DB_PREPARE_STATEMENTS` | (Optionnel) Active/désactive les prepared statements. Désactivé automatiquement quand le runtime passe par le transaction pooler Supabase. |
| `DB_APPLICATION_NAME` | (Optionnel) Nom injecté dans la connexion PostgreSQL pour l’observabilité côté Supabase. |
| `SESSION_COOKIE_SECRET`, `EMAIL_TRACKING_SECRET` | Longs secrets aléatoires. |
| `SESSION_COOKIE_NAME`, `SESSION_DURATION_HOURS` | Valeurs conformes à votre politique de session. |
| `SMTP_*` | Paramètres SMTP (production ≠ développement). |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | URL publique principale (ex. `https://app.mondomaine.com`). |
| `APP_HOSTNAMES` | Liste des hostnames autorisés pour l’interface (séparés par des virgules). |
| `CATALOG_EDGE_DOMAIN` | Cible CNAME utilisée pour les domaines personnalisés du site/catalogue. |
| `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | Nécessaires pour ajouter automatiquement les domaines personnalisés au projet Vercel (Team ID facultatif). |
| `PUPPETEER_DISABLE_SANDBOX` | Laisser à `"true"` sur Vercel pour éviter les erreurs Chromium. |
| `CRON_SECRET_TOKEN` | Jeton Bearer utilisé pour sécuriser `/api/cron/messaging` et `/api/jobs/metrics`. Obligatoire en production. |
| `JOBS_ALERT_WEBHOOK_URL` | (Optionnel) URL HTTP appelée quand un job échoue définitivement après tous les retries. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accès Supabase côté client (catalogue, assets, builder...). |

> Astuce : copiez le contenu de `.env.example`, remplacez les placeholders par les valeurs Supabase/Vercel, puis collez-les dans l’onglet _Environment Variables_ de Vercel.

### Supabase et réseaux IPv4

L’endpoint `db.<ref>.supabase.co` est IPv6-only. Les plateformes IPv4-only (Vercel, GitHub Actions, certains runners CI) doivent utiliser les poolers Supabase.

Configuration recommandée :

1. Réglez `DATABASE_URL` sur le transaction pooler Supabase (`aws-...pooler.supabase.com:6543?...&pgbouncer=true`) pour le runtime.
2. Réglez `DIRECT_URL` sur le session pooler (`aws-...pooler.supabase.com:5432`) pour les scripts et la maintenance.
3. Laissez `DB_RUNTIME_URL_MODE=auto` sauf besoin précis.
4. Conservez `DB_MAX_CONNECTIONS=1` en serverless, sauf charge/benchmark contraire.

### Checklist de mise en production

1. Vérifiez les variables d’environnement Vercel.
2. Appliquez vos éventuelles évolutions SQL via votre workflow Supabase avant le déploiement.
3. Déclenchez un déploiement Vercel.
4. Vérifiez les parcours critiques : auth, lecture/écriture métier, messagerie, génération PDF, cron jobs.

### Planification Messagerie

- Le workflow `.github/workflows/messaging-cron.yml` s’exécute toutes les 5 minutes et déclenche un `POST` sur `/api/cron/messaging`.
- Dans votre dépôt GitHub, ajoutez :
  - `CRON_ENDPOINT` → `https://votre-app.vercel.app/api/cron/messaging`
  - `CRON_SECRET_TOKEN` → même valeur que sur Vercel
- Les métriques restent accessibles via `/api/jobs/metrics?token=<CRON_SECRET_TOKEN>`.
