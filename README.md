## Développement

1. Installez les dépendances :

   ```bash
   npm install
   ```

2. Copiez `.env.example` vers `.env` et renseignez les secrets requis (PostgreSQL, SMTP, cookies, URLs).

3. Lancez le serveur de développement :

   ```bash
   npm run dev
   ```

4. Ouvrez `http://localhost:3000`.

Consultez `DEPLOY.md` pour les instructions de mise en production sur Vercel.

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
- Lier un domaine :
  1. Ajoutez votre domaine dans le formulaire “Domaine personnalisé”.
  2. Créez un CNAME vers `CATALOG_EDGE_DOMAIN` et un enregistrement TXT `verification=<domainVerificationCode>`.
  3. Cliquez sur **Vérifier**, puis **Activer**. Le statut progresse de _Pending_ → _Verified_ → _Active_. Une fois actif, votre site répond directement sur le domaine personnalisé tout en continuant à être accessible via l’URL slug.
- Flux de données : chaque soumission du formulaire (nom, email, téléphone, besoin) crée un client `source=WEBSITE_LEAD` dans l’onglet Clients, avec les besoins en note et les métadonnées (domaine, chemin, IP). Une notification e-mail est envoyée à l’adresse configurée et le formulaire applique une protection anti-spam (honeypot, détection de liens/anomalies, anti double soumission).
