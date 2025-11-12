## Déploiement sur Vercel

Cette application est optimisée pour tourner sur Vercel (Next.js 16 + Prisma + Supabase). Le build Vercel déclenche `npm run vercel-build`, qui orchestre les étapes suivantes :

1. `prisma generate`
2. `prisma migrate deploy` (si la base est joignable)
3. `next build`

Le script `scripts/run-vercel-build.cjs` saute automatiquement l’étape _migrate_ lorsque la base est hors d’accès (cas fréquent si Supabase est restreint par IP). Dans ce cas, un avertissement est affiché et **vous devez lancer `npm run prisma:deploy`** depuis une machine/CI qui a accès à la base (VPN, tunnel, GitHub Action, SQL editor Supabase, etc.) avant de mettre en production.

### Variables d’environnement à configurer sur Vercel

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Chaîne PostgreSQL via pooler/pgbouncer (ex. `aws-1-...pooler.supabase.com:6543` avec `?sslmode=require&pgbouncer=true`). Utilisée par l’application en production. |
| `DIRECT_URL` | Connexion directe (ex. `db.<ref>.supabase.co:5432`). Utilisée par Prisma pour les opérations nécessitant une session complète (migrations, `db push`, etc.). |
| `SHADOW_DATABASE_URL` | Base de shadow utilisée par `prisma migrate dev`. Vous pouvez la garder identique à `DIRECT_URL` avec `schema=shadow`. |
| `PRISMA_ACCELERATE_URL` | URL Data Proxy/Accelerate (format `prisma://accelerate.prisma-data.net/?api_key=...`). Active la mise en cache/connection pooling côté Prisma pour Vercel. |
| `SESSION_COOKIE_SECRET`, `EMAIL_TRACKING_SECRET` | Longs secrets aléatoires. |
| `SESSION_COOKIE_NAME`, `SESSION_DURATION_HOURS` | Valeurs conformes à votre politique de session. |
| `SMTP_*` | Paramètres SMTP (production ≠ développement). |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | URL publique principale (ex. `https://app.mondomaine.com`). |
| `APP_HOSTNAMES` | Liste des hostnames autorisés pour l’interface (séparés par des virgules). |
| `CATALOG_EDGE_DOMAIN` | Cible CNAME utilisée pour les domaines personnalisés du site/catalogue. |
| `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | Nécessaires pour ajouter automatiquement les domaines personnalisés au projet Vercel (Team ID facultatif). |
| `PUPPETEER_DISABLE_SANDBOX` | Laisser à `"true"` sur Vercel pour éviter les erreurs Chromium. |
| `CRON_SECRET_TOKEN` | Jeton Bearer utilisé pour sécuriser `/api/cron/messaging` et `/api/jobs/metrics`. Obligatoire en production (le scheduler Vercel doit envoyer `Authorization: Bearer <token>`). |
| `JOBS_ALERT_WEBHOOK_URL` | (Optionnel) URL HTTP appelée quand un job échoue définitivement après tous les retries. Permet d’acheminer les alertes vers Slack, Teams, etc. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accès Supabase côté client (analytics, builder...). |

> Astuce : copiez le contenu de `.env.example`, remplacez les placeholders par les valeurs Supabase/Vercel, puis collez-les dans l’onglet _Environment Variables_ de Vercel.

Pour `VERCEL_TOKEN`, créez un token personnel depuis **Account Settings → Tokens** (ou **Team Settings** si applicable) et ajoutez également `VERCEL_PROJECT_ID` (fourni automatiquement sur Vercel) ainsi que `VERCEL_TEAM_ID` si le projet appartient à une équipe. Sans ces variables, l’action **Activer** ne pourra pas rattacher le domaine et Vercel renverra `DEPLOYMENT_NOT_FOUND`.

#### Planification Messagerie (Vercel Cron)

- `vercel.json` déclare un Cron (`*/1 * * * *`) qui cible `/api/cron/messaging`. Activez la fonctionnalité “Cron Jobs” sur votre projet Vercel (onglet **Settings → Cron Jobs**) pour qu’elle soit créée automatiquement lors du prochain `vercel deploy`.
- Réglez `CRON_SECRET_TOKEN` et copiez le même token dans la configuration Cron (header `Authorization: Bearer <token>`). Sans ce header, l’API renvoie 401 en production.
- Les métriques peuvent être interrogées via `/api/jobs/metrics?token=<CRON_SECRET_TOKEN>` pour exposer l’état de la file ou brancher un dashboard externe.
- Facultatif : configurez `JOBS_ALERT_WEBHOOK_URL` pour recevoir une notification HTTP (JSON) lorsqu’un job échoue définitivement après les retries (exponential backoff).

#### Supabase et réseaux IPv4 (Vercel, GitHub Actions…)

L’endpoint `db.<ref>.supabase.co` est uniquement IPv6. Les plateformes IPv4-only (Vercel, GitHub Actions, Render, Retool, etc.) ne peuvent donc pas l’atteindre tant que vous n’avez pas souscrit à l’option IPv4 de Supabase. Pour que les builds Vercel s’exécutent quand même :

1. Réglez `DATABASE_URL` sur le **transaction pooler** Supabase (`aws-1-...pooler.supabase.com:6543` avec `pgbouncer=true`).  
2. Réglez `DIRECT_URL` et `SHADOW_DATABASE_URL` sur le **session pooler** (`aws-1-...pooler.supabase.com:5432` sans `pgbouncer=true`). Ce host est IPv4 et compatible avec `prisma migrate deploy`.  
3. Gardez ces valeurs identiques sur Vercel, GitHub Actions et en local, ou surchargez-les via `.env.local` si nécessaire.  
4. Si vous préférez utiliser l’endpoint “direct” natif, déclenchez `npm run prisma:deploy` depuis une machine/CI connectée en IPv6 (VPN, VPS, Supabase SQL Editor…) avant de lancer un déploiement Vercel.

### Contrôle fin des migrations pendant le build

Le script `run-vercel-build.cjs` expose plusieurs flags :

| Variable | Effet |
| --- | --- |
| `SKIP_PRISMA_MIGRATE_ON_BUILD=1` | Ne lance jamais `prisma migrate deploy` pendant le build. |
| `FORCE_PRISMA_MIGRATE_ON_BUILD=1` | Forcer l’exécution des migrations même si `SKIP_*` est défini. |
| `ALLOW_MIGRATION_SKIP_ON_BUILD=0` | Rendre l’échec bloquant, même pour les erreurs réseau (`P1001`). |

Par défaut, le build **essaie** de lancer les migrations, mais si la base ne répond pas (`P1001`), elles sont ignorées pour ne pas bloquer le déploiement. Surveillez les logs Vercel : tant que vous voyez l’avertissement `Prisma migrations were skipped`, lancez `npm run prisma:deploy` manuellement avant d’ouvrir l’application aux utilisateurs.

### Checklist de mise en production

1. **Mettre à jour les variables d’environnement** sur Vercel (base, Supabase, SMTP, secrets, URLs publiques).
2. **Exécuter les migrations** :
   ```bash
   npm run prisma:deploy
   ```
   (À lancer localement ou via un job CI disposant d’un accès réseau à Supabase.)
3. **Déclencher un déploiement** (commit → GitHub → Vercel). Le build doit afficher soit `prisma migrate deploy` réussi, soit un avertissement (cf. ci-dessus).
4. **Vérifier l’application** (`npm run build` ou déploiement Vercel) puis tester la messagerie/SMTP et la génération PDF si besoin (`PUPPETEER_DISABLE_SANDBOX=true`).

En cas de question ou pour automatiser les migrations (GitHub Action, script Supabase), adaptez les variables ci-dessus : le build pourra rester non bloquant tout en garantissant qu’une étape dédiée applique les migrations avant la mise en production.
