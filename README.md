## Développement

1. Installez les dépendances :

   ```bash
   npm install
   ```

2. Copiez `.env.example` vers `.env` et ajustez les variables (SQLite par défaut).

3. Lancez le serveur de développement :

   ```bash
   npm run dev
   ```

4. Ouvrez `http://localhost:3000`.

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
