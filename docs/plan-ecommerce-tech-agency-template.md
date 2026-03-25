# Plan d implementation - Template E-commerce Tech Agency

## 1) Current repo analysis

- Architecture Next.js App Router: routes sous `src/app`, public catalogue dans `src/app/catalogue/[[...segments]]/page.tsx`, preview dans `src/app/preview/page.tsx`.
- Multi-domain/public vs admin: `middleware.ts` rewrites les domaines custom vers `/catalogue` + params `domain`/`path`, hostnames resolves dans `src/lib/env.ts` via `getAppHostnames()` et `getCatalogEdgeDomain()`.
- Module Site Web: UI admin dans `src/app/(app)/site-web`, actions dans `src/app/(app)/site-web/actions.ts`, logique serveur dans `src/server/website.ts`, builder avance dans `src/app/(app)/site-web/personnalisation-avancee` et schema builder dans `src/lib/website/builder.ts`.
- Templates existants: clefs dans `src/lib/website/templates.ts`, rendu par `src/components/website/catalog-page.tsx`, composants `src/components/website/templates/dev-agency.tsx` et `src/components/website/templates/ecommerce.tsx` (UI ecommerce statique, pas de flux commande/paiement reel).
- Produits: modele `Product` dans `prisma/schema.prisma`, logique serveur dans `src/server/products.ts`, UI admin dans `src/app/(app)/produits`, catalogue public charge via `src/server/website.ts` (`listCatalogProducts`, `CatalogPayload`).
- Devis/Factures: modeles `Quote`/`Invoice` dans `prisma/schema.prisma`, logique dans `src/server/quotes.ts` et `src/server/invoices.ts`, UI dans `src/app/(app)/devis` et `src/app/(app)/factures`.
- PDF/Email: generation PDF dans `src/server/pdf.ts`, emails devis/factures dans `src/server/email.ts`, jobs dans `src/server/document-email-jobs.ts`, systeme SMTP/IMAP dans `src/server/messaging.ts`, templates par defaut dans `src/lib/messaging/default-responses.ts`.
- Paiement: table `Payment` liee aux factures + `recordPayment` dans `src/server/invoices.ts`, aucune integration provider ni webhook dans le repo.
- Migrations/RLS: migrations Prisma dans `prisma/migrations` (ex: `20251215104500_website_builder_customization`), pas de politiques RLS dans ce repo.

## 2) Target architecture

- Point d entree public unique via `/catalogue/[[...segments]]` et `CatalogPage` (`src/components/website/catalog-page.tsx`), avec routing interne dans le nouveau template (home, catalogue, detail, panier, checkout, paiement, confirmation, contact).
- Resolution tenant par slug ou domaine: reutiliser `getCatalogPayloadBySlug()` / `getCatalogPayloadByDomain()` dans `src/server/website.ts` et le pattern de `src/app/api/catalogue/leads/route.ts` pour les nouveaux endpoints publics.
- Nouveau template client `src/components/website/templates/ecommerce-tech-agency.tsx` base sur `CatalogPayload` + `WebsiteBuilderConfig` pour les sections, avec design moderne agence digitale et textes FR.
- Flux commerce: panier client-side, checkout poste vers API (`src/app/api/catalogue/orders/route.ts`), creation `Order`/`OrderItem`, confirmation, emails transactionnels via `src/server/messaging.ts` et jobs.
- Flux devis: produits en mode devis creent `QuoteRequest` via API publique, puis conversion vers `Quote`/`Invoice` via actions admin.
- Admin: nouvelles sous-routes Site Web pour `Commandes` et `Demandes de devis`, en s appuyant sur modules serveur `src/server/orders.ts` et `src/server/quote-requests.ts`.
- Paiements: pas de provider existant -> couche d abstraction provider-agnostic + webhooks optionnels, avec option virement bancaire (infos dans `WebsiteConfig` ou `CompanySettings`).

## 3) DB schema plan

- Produit (`Product` dans `prisma/schema.prisma`):
  - Ajouter un mode de vente (`saleMode`: INSTANT | QUOTE) pour distinguer achat direct vs demande de devis.
  - Ajouter un slug public (`publicSlug`, unique par `userId`) pour la page detail.
  - Ajouter contenu listing/medias (ex: `excerpt`, `coverImageUrl`, `gallery` JSON) + `quoteFormSchema` JSON pour les formulaires devis.
- WebsiteConfig:
  - Option A (recommande): ajouter `ecommerceSettings` JSON (modes de paiement actifs, infos virement, regles checkout, produits mis en avant, CGV/mentions).
  - Option B: table dediee `WebsiteEcommerceConfig` si besoin de requetes avancees; dependance: volume et filtres admin.
- Commandes:
  - Nouvelle table `Order` + `OrderItem` + `OrderPayment` (status, paiement, totals, customer infos, lien `invoiceId`/`quoteId`).
  - Indexes sur `(userId, status, createdAt)` et `(userId, orderNumber)`.
- Demandes de devis:
  - Nouvelle table `QuoteRequest` + option `QuoteRequestAttachment` pour fichiers; lien `quoteId` une fois converti.
  - Indexes sur `(userId, status, createdAt)`.
- Panier:
  - Option A: panier client-side uniquement (pas de tables).
  - Option B: `Cart`/`CartItem` si besoin de reprise multi-device (dependance: choix produit).
- RLS:
  - Option A: policies RLS hors repo si Supabase est utilise.
  - Option B: garder scoping applicatif via `userId` comme dans les modules existants.

## 4) Task list grouped by phases

### Foundation

- T1.1 Etendre `Product` et `WebsiteConfig` pour le mode ecommerce
- T1.2 Ajouter les modeles `Order`/`OrderItem`/`OrderPayment` et `QuoteRequest`
- T1.3 Ajouter la configuration ecommerce dans l UI Site Web

### Public Template

- T2.1 Enregistrer le template "ecommerce-tech-agency"
- T2.2 Construire le template (layout + routing interne)
- T2.3 Brancher les donnees produits/sections au template

### Cart/Checkout

- T3.1 Implementer la gestion panier cote client
- T3.2 Implementer checkout + creation commande + confirmation

### Payments

- T4.1 Ajouter une couche paiement provider-agnostic (Option A/B)
- T4.2 Ajouter le flux virement bancaire + preuve
- T4.3 Ajouter les emails transactionnels commandes/devis

### Admin Orders

- T5.1 Ajouter la liste/filtre des commandes
- T5.2 Ajouter le detail commande + actions

### Quote Requests

- T6.1 Ajouter le formulaire demande de devis public
- T6.2 Ajouter la gestion admin + conversion en devis

### SEO/Perf

- T7.1 Adapter les metadata aux nouvelles pages
- T7.2 Ajouter sitemap/robots et optimisations perf

### QA/Release

- T8.1 Ajouter la couverture de tests
- T8.2 Mettre a jour seed/migrations et checklist release

---

## T1.1 - Etendre Product et WebsiteConfig pour le mode ecommerce

Status: ✅ Completed

- Objectif: Ajouter les champs necessaires pour vente directe, devis, slug public et configuration checkout.
- Pourquoi: Permettre le catalogue public, la page detail, le choix achat vs devis, et la configuration paiement dans Site Web.
- Notes de decouverte du repo: `prisma/schema.prisma` contient `Product` et `WebsiteConfig`, validation produit dans `src/server/products.ts`, formulaire produit dans `src/app/(app)/produits/product-form.tsx`, config Site Web dans `src/app/(app)/site-web/_components/website-content-form.tsx`.
- Details d implementation:
  - Ajouter a `Product`: `saleMode` (enum), `publicSlug`, `excerpt`, `coverImageUrl`, `gallery` JSON, `quoteFormSchema` JSON.
  - Ajouter a `WebsiteConfig`: `ecommerceSettings` JSON avec structure initiale (paiements actifs, info virement, regles checkout, produits mis en avant).
  - Mettre a jour `productSchema` et parsers dans `src/server/products.ts` et `src/app/(app)/produits/actions.ts`.
  - Mettre a jour le formulaire `src/app/(app)/produits/product-form.tsx` pour les nouveaux champs.
- Fichiers a creer/modifier:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_ecommerce_product_fields/migration.sql`
  - `src/server/products.ts`
  - `src/app/(app)/produits/product-form.tsx`
  - `src/app/(app)/produits/actions.ts`
  - `src/server/website.ts`
- Changements DB:
  - Migration Prisma ajoutant colonnes et enums pour `Product` + colonne JSON `ecommerceSettings` pour `WebsiteConfig`.
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - `src/app/(app)/produits/page.tsx`
  - `src/app/(app)/site-web/page.tsx`
- Criteres d acceptation (DoD):
  - [ ] Un produit peut etre defini en mode achat direct ou devis.
  - [ ] Un produit a un slug public unique et option medias/extrait.
  - [ ] Les settings ecommerce sont persistants dans `WebsiteConfig`.
- Plan de test:
  - Unit: validation Zod sur `productSchema`.
  - Integration: creation/modif produit via `submitProductFormAction`.
- Risques et mitigation:
  - Collision de slug: generer un fallback a partir du nom et valider l unicite.
  - Migration data: definir defaults (saleMode=INSTANT, publicSlug derive du SKU).
- Effort estime: M.

## T1.2 - Ajouter les modeles Order/OrderItem/OrderPayment et QuoteRequest

Status: ✅ Completed

- Objectif: Creer le socle de persistance pour commandes, paiements et demandes de devis.
- Pourquoi: Necessaire pour les flux checkout et la gestion admin (Commandes / Demandes de devis).
- Notes de decouverte du repo: aucune table commande existante dans `prisma/schema.prisma`; patterns de calcul dans `src/lib/documents.ts`; devis/factures dans `src/server/quotes.ts` et `src/server/invoices.ts`.
- Details d implementation:
  - Ajouter models Prisma: `Order`, `OrderItem`, `OrderPayment`, `QuoteRequest`, `QuoteRequestAttachment`.
  - Ajouter enums: `OrderStatus`, `OrderPaymentStatus`, `QuoteRequestStatus`.
  - Ajouter indexes `(userId, status, createdAt)` + uniques (ex: `orderNumber`).
  - Creer `src/server/orders.ts` et `src/server/quote-requests.ts` avec schemas Zod, create/list/update, et calcul totals via `calculateLineTotals`.
  - Ajouter helper pour lier/creer un `Client` (ex: util dans `src/server/clients.ts`).
- Fichiers a creer/modifier:
  - `prisma/schema.prisma`
  - `prisma/migrations/<timestamp>_ecommerce_orders/migration.sql`
  - `src/server/orders.ts`
  - `src/server/quote-requests.ts`
  - `src/server/clients.ts`
- Changements DB:
  - Nouvelles tables + enums + indexes.
- API/routes requises: Aucune.
- UI/ecrans impactes: Aucun.
- Criteres d acceptation (DoD):
  - [ ] Les modules serveur permettent create/list/update commandes et demandes.
  - [ ] Les datas sont scopees par `userId` comme les autres modules.
- Plan de test:
  - Unit: tests des schemas et calculs de totals.
  - Integration: creation commande et demande de devis via modules serveur.
- Risques et mitigation:
  - Incoherence totals: reutiliser `src/lib/documents.ts` et figer les prix lors de la commande.
- Effort estime: L.

## T1.3 - Ajouter la configuration ecommerce dans l UI Site Web
Status: ✅ Completed

- Objectif: Exposer la configuration ecommerce (paiement, produits, checkout) dans Site Web.
- Pourquoi: Les admins doivent controler branding, SEO, selection produits, regles checkout et paiements.
- Notes de decouverte du repo: form principal dans `src/app/(app)/site-web/_components/website-content-form.tsx`, actions dans `src/app/(app)/site-web/actions.ts`, data dans `src/server/website.ts`.
- Details d implementation:
  - Ajouter une section UI dediee (ex: "E-commerce") avec champs pour modes de paiement, infos virement, produits mis en avant, regles checkout.
  - Ajouter une action serveur pour sauver `ecommerceSettings` (nouveau schema Zod a cote de `websiteContentSchema`).
  - Etendre `getWebsiteAdminPayload()` pour exposer les settings ecommerce.
- Fichiers a creer/modifier:
  - `src/app/(app)/site-web/_components/website-content-form.tsx`
  - `src/app/(app)/site-web/actions.ts`
  - `src/server/website.ts`
  - `src/lib/website/templates.ts`
- Changements DB: Aucun (utilise `ecommerceSettings` de T1.1).
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - `src/app/(app)/site-web/page.tsx`
- Criteres d acceptation (DoD):
  - [ ] Les champs ecommerce sont visibles et sauvegardes.
  - [ ] Les valeurs sont retournees dans le payload admin.
- Plan de test:
  - Integration: sauvegarde config via action `saveWebsiteContentAction` ou nouvelle action.
- Risques et mitigation:
  - Form trop charge: isoler la section ecommerce dans une card separee.
- Effort estime: M.

## T2.1 - Enregistrer le template "ecommerce-tech-agency"

Status: ✅ Completed

- Objectif: Ajouter la nouvelle cle de template et le mapping de rendu.
- Pourquoi: Rendre le template selectionnable dans Site Web et utilisable sur le public.
- Notes de decouverte du repo: `src/lib/website/templates.ts` liste les clefs; `src/components/website/catalog-page.tsx` mappe les composants; `src/server/website.ts` force des sections pour `ecommerce-luxe`.
- Details d implementation:
  - Ajouter la cle `ecommerce-tech-agency` dans `WEBSITE_TEMPLATE_KEY_VALUES` et `WEBSITE_TEMPLATES`.
  - Ajouter le composant dans `TEMPLATE_COMPONENTS`.
  - Etendre `ensureTemplateSections()` pour injecter sections requises pour ce template.
- Fichiers a creer/modifier:
  - `src/lib/website/templates.ts`
  - `src/components/website/catalog-page.tsx`
  - `src/server/website.ts`
- Changements DB: Aucun.
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - `src/app/(app)/site-web/_components/website-content-form.tsx` (select template)
- Criteres d acceptation (DoD):
  - [ ] Le template apparait dans le select admin.
  - [ ] La preview affiche le nouveau template sans erreurs.
- Plan de test:
  - Manual: choisir le template et ouvrir `/preview`.
- Risques et mitigation:
  - Builder incomplet: injecter des sections par defaut si manquantes.
- Effort estime: S.

## T2.2 - Construire le template (layout + routing interne)

Status: ✅ Completed

- Objectif: Creer l UI moderne agence digitale avec toutes les pages requises.
- Pourquoi: Le template doit couvrir home, catalogue, detail, panier, checkout, paiement, confirmation, contact.
- Notes de decouverte du repo: pattern routing interne dans `src/components/website/templates/ecommerce.tsx` (`resolvePage`).
- Details d implementation:
  - Creer `src/components/website/templates/ecommerce-tech-agency.tsx` (client component).
  - Ajouter un resolver de path pour `home`, `catalogue`, `produit/:slug`, `panier`, `checkout/paiement`, `confirmation`, `contact`.
  - Definir un design system propre (variables CSS via `style` local ou classes), avec sections hero, services, preuves sociales, CTA.
  - Rester FR uniquement pour les libelles.
- Fichiers a creer/modifier:
  - `src/components/website/templates/ecommerce-tech-agency.tsx`
  - Optionnel: `src/components/website/templates/ecommerce-tech-agency/*.tsx` (sous-composants)
- Changements DB: Aucun.
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - Public site via `src/app/catalogue/[[...segments]]/page.tsx`
- Criteres d acceptation (DoD):
  - [ ] Les pages demandees sont rendues dans le template.
  - [ ] Le template est responsive et coherant visuellement.
- Plan de test:
  - Manual: parcourir les routes `/catalogue/<slug>/...` et `/preview`.
- Risques et mitigation:
  - Complexite UI: decouper en sous-composants.
- Effort estime: M/L.

## T2.3 - Brancher les donnees produits/sections au template

Status: ✅ Completed

- Objectif: Utiliser les vrais produits et le builder pour alimenter le template.
- Pourquoi: Le catalogue doit refleter les produits du module Produits.
- Notes de decouverte du repo: `CatalogPayload` dans `src/server/website.ts`, `CatalogPage` dans `src/components/website/catalog-page.tsx`.
- Details d implementation:
  - Etendre `CatalogProduct` et `listCatalogProducts` pour remonter `publicSlug`, `saleMode`, `excerpt`, `coverImageUrl`, `gallery`.
  - Ajouter une helper slug (Option A: reutiliser `slugify` de `src/server/website.ts` en la deplacant dans `src/lib/slug.ts`).
  - Dans le template, rechercher le produit detail via `publicSlug` et afficher les champs utiles.
  - Utiliser `WebsiteBuilderConfig` pour alimenter hero/sections si dispo.
- Fichiers a creer/modifier:
  - `src/server/website.ts`
  - `src/lib/website/builder.ts`
  - `src/components/website/templates/ecommerce-tech-agency.tsx`
  - Optionnel: `src/lib/slug.ts`
- Changements DB: Aucun.
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - Pages catalogue/detail du template.
- Criteres d acceptation (DoD):
  - [ ] Les produits visibles s affichent avec prix/CTA selon `saleMode`.
  - [ ] La page detail utilise le `publicSlug`.
- Plan de test:
  - Manual: verif detail produit + listing.
- Risques et mitigation:
  - Produit sans slug: generer fallback depuis nom/sku.
- Effort estime: M.

## T3.1 - Implementer la gestion panier cote client

Status: ✅ Completed

- Objectif: Ajouter un panier persistant pour les achats directs.
- Pourquoi: Le flux ecommerce exige ajout au panier et gestion quantites.
- Notes de decouverte du repo: aucune logique panier existante; templates actuels ont des boutons statiques.
- Details d implementation:
  - Creer un contexte panier (ex: `src/components/website/cart/cart-context.tsx`) avec actions add/remove/update.
  - Stocker le panier en localStorage (key par `website.id` pour eviter collisions multi-tenant).
  - Connecter le compteur panier et les boutons "Ajouter au panier" dans le template.
  - Option B: si besoin multi-device, introduire tables `Cart`/`CartItem` (dependance: choix produit).
- Fichiers a creer/modifier:
  - `src/components/website/cart/cart-context.tsx`
  - `src/components/website/templates/ecommerce-tech-agency.tsx`
- Changements DB: Aucun (Option A).
- API/routes requises: Aucune (Option A).
- UI/ecrans impactes:
  - Pages produit et panier.
- Criteres d acceptation (DoD):
  - [ ] Ajouter/retirer un produit met a jour le panier et le total.
  - [ ] Le panier persiste au refresh.
- Plan de test:
  - Unit: hook panier.
  - Manual: ajout/suppression/quantites.
- Risques et mitigation:
  - Donnees stale: nettoyer le panier si produit supprime.
- Effort estime: M.

## T3.2 - Implementer checkout + creation commande + confirmation

Status: ✅ Completed

- Objectif: Creer une commande depuis le checkout et afficher la confirmation.
- Pourquoi: La conversion achat est centrale au template ecommerce.
- Notes de decouverte du repo: pattern API publique dans `src/app/api/catalogue/leads/route.ts`, calculs dans `src/lib/documents.ts`.
- Details d implementation:
  - Ajouter `POST /api/catalogue/orders` (`src/app/api/catalogue/orders/route.ts`) pour valider payload, resoudre tenant (slug/domaine), creer `Order`/`OrderItem`.
  - Gerer `mode=preview` comme dans le lead form (aucune creation).
  - Retourner un identifiant de confirmation (Option A: `orderId` + token public).
  - Afficher la page confirmation dans le template (etat client-side ou fetch API).
- Fichiers a creer/modifier:
  - `src/app/api/catalogue/orders/route.ts`
  - `src/server/orders.ts`
  - `src/components/website/templates/ecommerce-tech-agency.tsx`
- Changements DB: Utilise tables `Order`/`OrderItem` de T1.2.
- API/routes requises:
  - `POST /api/catalogue/orders`
  - Optionnel: `GET /api/catalogue/orders/:id` (si besoin de recup apres refresh)
- UI/ecrans impactes:
  - Checkout, confirmation.
- Criteres d acceptation (DoD):
  - [ ] Une commande est creee pour un panier valide.
  - [ ] La confirmation affiche un resume coherent.
- Plan de test:
  - Integration: tests API orders.
  - Manual: checkout complet en preview et public.
- Risques et mitigation:
  - Fraude sur prix: recalculer totals cote serveur a partir des produits.
- Effort estime: L.

## T4.1 - Ajouter une couche paiement provider-agnostic (Option A/B)

Status: ✅ Completed

- Objectif: Preparer l integration paiement sans choisir de provider.
- Pourquoi: Le repo ne contient aucun provider; il faut une base extensible.
- Notes de decouverte du repo: aucune integration paiement, seulement `Payment` pour factures (`src/server/invoices.ts`).
- Details d implementation:
  - Creer un module `src/server/payments.ts` avec interface `createCheckoutSession` / `handleWebhook` / `mapStatus`.
  - Option A: laisser un provider "stub" + webhooks vides, en attente de choix.
  - Option B: implementer uniquement virement bancaire (pas de provider).
  - Ajouter `src/app/api/catalogue/payments/webhook/route.ts` si Option A.
- Fichiers a creer/modifier:
  - `src/server/payments.ts`
  - `src/app/api/catalogue/payments/webhook/route.ts`
  - `src/server/orders.ts`
- Changements DB:
  - Utiliser `OrderPayment` pour stocker status/externalRef.
- API/routes requises:
  - `POST /api/catalogue/payments/webhook` (Option A)
- UI/ecrans impactes:
  - Checkout (selection du moyen de paiement).
- Criteres d acceptation (DoD):
  - [ ] Le code permet d ajouter un provider sans casser le flux commande.
  - [ ] Le statut paiement est synchronise sur l order.
- Plan de test:
  - Unit: mapping status -> OrderStatus.
- Risques et mitigation:
  - Choix provider inconnu: documenter dependances (API keys, webhook secrets).
- Effort estime: M.

## T4.2 - Ajouter le flux virement bancaire + preuve

Status: ✅ Completed

- Objectif: Supporter le virement bancaire avec upload de preuve et validation.
- Pourquoi: Requis comme alternative au paiement en ligne.
- Notes de decouverte du repo: upload fichiers present pour logos dans `src/app/(app)/messagerie/actions.ts` (uploads dans `public/uploads`).
- Details d implementation:
  - Exposer dans le checkout les infos virement (depuis `ecommerceSettings` ou `CompanySettings.iban`).
  - Option A: upload preuve cote client via `POST /api/catalogue/orders/:id/transfer-proof`.
  - Option B: upload preuve par l admin dans le detail commande.
  - Stocker metadata (url, mime, size, uploadedAt) dans `OrderPayment` ou table `OrderPaymentProof`.
- Fichiers a creer/modifier:
  - `src/app/api/catalogue/orders/[id]/transfer-proof/route.ts` (Option A)
  - `src/app/(app)/site-web/commandes/actions.ts` (Option B)
  - `src/server/orders.ts`
  - `src/components/website/templates/ecommerce-tech-agency.tsx`
- Changements DB:
  - Ajouter champs preuves (ex: `proofUrl`, `proofStatus`) ou table dediee.
- API/routes requises:
  - `POST /api/catalogue/orders/:id/transfer-proof` (Option A)
- UI/ecrans impactes:
  - Checkout, confirmation, detail commande admin.
- Criteres d acceptation (DoD):
  - [ ] Les instructions virement sont visibles.
  - [ ] Une preuve peut etre chargee et validee.
- Plan de test:
  - Integration: upload + validation proof.
- Risques et mitigation:
  - Stockage fichiers: limiter taille/type et reutiliser pattern `public/uploads`.
- Effort estime: M.

## T4.3 - Ajouter les emails transactionnels commandes/devis

Status: ✅ Completed

- Objectif: Envoyer confirmations et mises a jour via le systeme email existant.
- Pourquoi: Requis pour les evenements commande et demande de devis.
- Notes de decouverte du repo: emails dans `src/server/email.ts`, jobs dans `src/server/document-email-jobs.ts`, SMTP dans `src/server/messaging.ts`.
- Details d implementation:
  - Ajouter templates (commande creee, paiement recu, devis demande) dans `src/lib/messaging/default-responses.ts` ou un module dedie.
  - Creer un service d envoi (ex: `src/server/order-email.ts`) qui utilise `sendEmailMessageForUser`.
  - Ajouter un job queue similaire a `document-email-jobs.ts` si envoi asynchrone.
  - Declencher depuis creation/maj commande et creation demande de devis.
- Fichiers a creer/modifier:
  - `src/lib/messaging/default-responses.ts`
  - `src/server/order-email.ts`
  - `src/server/background-jobs.ts`
  - `src/server/orders.ts`
  - `src/server/quote-requests.ts`
- Changements DB: Aucun.
- API/routes requises: Aucune.
- UI/ecrans impactes: Aucun.
- Criteres d acceptation (DoD):
  - [ ] Un email est envoye a la creation commande.
  - [ ] Un email est envoye a la creation demande de devis.
- Plan de test:
  - Unit: generation template + placeholders.
  - Integration: job enqueue sur creation.
- Risques et mitigation:
  - SMTP non configure: reutiliser les checks de `getMessagingSettingsSummary`.
- Effort estime: M.

## T5.1 - Ajouter la liste/filtre des commandes

Status: ✅ Completed

- Objectif: Afficher les commandes dans Site Web avec filtres et statuts.
- Pourquoi: Les admins doivent piloter les commandes et paiements.
- Notes de decouverte du repo: tables listes similaires dans `src/app/(app)/devis` et `src/app/(app)/factures`.
- Details d implementation:
  - Creer `src/app/(app)/site-web/commandes/page.tsx` avec table + filtres (status, paiement, date).
  - Ajouter un client component pour recherche/pagination.
  - Appeler `listOrders()` depuis `src/server/orders.ts`.
- Fichiers a creer/modifier:
  - `src/app/(app)/site-web/commandes/page.tsx`
  - `src/app/(app)/site-web/commandes/orders-table-client.tsx`
  - `src/server/orders.ts`
- Changements DB: Aucun.
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - Admin Site Web > Commandes.
- Criteres d acceptation (DoD):
  - [ ] Les commandes sont visibles avec filtres et statuts.
- Plan de test:
  - Integration: listOrders + filtres.
- Risques et mitigation:
  - Volume important: ajouter pagination et indexes.
- Effort estime: M.

## T5.2 - Ajouter le detail commande + actions

Status: ✅ Completed

- Objectif: Gerer le statut, paiement, notes internes et generation facture/devis.
- Pourquoi: Necessaire pour le suivi et la conversion vers factures/devis.
- Notes de decouverte du repo: actions facture dans `src/server/invoices.ts`, conversion devis->facture dans `src/server/quotes.ts`.
- Details d implementation:
  - Creer `src/app/(app)/site-web/commandes/[id]/page.tsx` avec resume, items, paiement, notes.
  - Ajouter actions server (`cancel`, `markPaid`, `markDelivered`) dans `src/app/(app)/site-web/commandes/actions.ts`.
  - Ajouter bouton "Generer facture" qui cree une `Invoice` a partir de la commande (nouvelle helper dans `src/server/invoices.ts` ou `src/server/orders.ts`).
  - Ajouter bouton "Generer devis" si besoin d une proposition avant facture.
- Fichiers a creer/modifier:
  - `src/app/(app)/site-web/commandes/[id]/page.tsx`
  - `src/app/(app)/site-web/commandes/actions.ts`
  - `src/server/orders.ts`
  - `src/server/invoices.ts`
  - `src/server/quotes.ts`
- Changements DB:
  - Optionnel: `Order.invoiceId` / `Order.quoteId`.
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - Detail commande admin.
- Criteres d acceptation (DoD):
  - [ ] Le statut commande peut etre mis a jour.
  - [ ] Une facture ou un devis peut etre genere depuis une commande.
- Plan de test:
  - Integration: actions status + creation facture.
- Risques et mitigation:
  - Donnees client manquantes: forcer la collecte email/nom au checkout.
- Effort estime: L.

## T6.1 - Ajouter le formulaire demande de devis public

Status: ✅ Completed

- Objectif: Permettre la demande de devis pour les produits en mode QUOTE.
- Pourquoi: Le catalogue doit supporter achat direct ou devis.
- Notes de decouverte du repo: lead form existant dans `src/components/website/lead-form.tsx` et API dans `src/app/api/catalogue/leads/route.ts`.
- Details d implementation:
  - Afficher un formulaire devis sur la page detail si `saleMode=QUOTE`.
  - Rendre le formulaire dynamique via `Product.quoteFormSchema` (fallback sur un formulaire standard).
  - Ajouter `POST /api/catalogue/quote-requests` avec resolution tenant (slug/domaine) et anti-spam similaire au lead.
- Fichiers a creer/modifier:
  - `src/components/website/templates/ecommerce-tech-agency.tsx`
  - `src/app/api/catalogue/quote-requests/route.ts`
  - `src/server/quote-requests.ts`
- Changements DB:
  - Utilise `QuoteRequest` de T1.2.
- API/routes requises:
  - `POST /api/catalogue/quote-requests`
- UI/ecrans impactes:
  - Detail produit public.
- Criteres d acceptation (DoD):
  - [ ] Une demande de devis est creee avec les champs fournis.
  - [ ] Le mode preview ne persiste rien.
- Plan de test:
  - Integration: creation `QuoteRequest` via API.
- Risques et mitigation:
  - Spam: reutiliser honeypot + checks comme `recordWebsiteLead`.
- Effort estime: M.

## T6.2 - Ajouter la gestion admin + conversion en devis

Status: ✅ Completed

- Objectif: Permettre la consultation des demandes et la conversion en devis.
- Pourquoi: Les admins doivent transformer une demande en Devis existant.
- Notes de decouverte du repo: creation devis via `createQuote` dans `src/server/quotes.ts`, UI devis dans `src/app/(app)/devis`.
- Details d implementation:
  - Creer `src/app/(app)/site-web/demandes-de-devis/page.tsx` et `[id]/page.tsx`.
  - Afficher les champs dynamiques et fichiers associes.
  - Ajouter action "Convertir en devis" qui mappe la demande vers `QuoteInput` puis appelle `createQuote`.
  - Lier `quoteId` et mettre a jour le statut de la demande.
- Fichiers a creer/modifier:
  - `src/app/(app)/site-web/demandes-de-devis/page.tsx`
  - `src/app/(app)/site-web/demandes-de-devis/[id]/page.tsx`
  - `src/app/(app)/site-web/demandes-de-devis/actions.ts`
  - `src/server/quote-requests.ts`
  - `src/server/quotes.ts`
- Changements DB:
  - Champ `quoteId` sur `QuoteRequest`.
- API/routes requises: Aucune.
- UI/ecrans impactes:
  - Admin Site Web > Demandes de devis.
- Criteres d acceptation (DoD):
  - [ ] Les demandes sont listables avec details.
  - [ ] La conversion cree un devis et lie la demande.
- Plan de test:
  - Integration: conversion demande -> devis.
- Risques et mitigation:
  - Donnees insuffisantes: definir un fallback pour les champs manquants.
- Effort estime: L.

## T7.1 - Adapter les metadata aux nouvelles pages

Status: ✅ Completed

- Objectif: Generer des metadata SEO pour home, categories, detail produit.
- Pourquoi: Ameliorer le SEO du template public.
- Notes de decouverte du repo: `generateMetadata` dans `src/app/catalogue/[[...segments]]/page.tsx` se base sur `website.metadata`.
- Details d implementation:
  - Ajouter un resolver metadata par path (ex: produit detail -> title/description produit).
  - Option A: etendre `getCatalogPayloadBySlug` pour fournir meta par path.
  - Option B: ajouter une requete serveur pour un produit par `publicSlug` dans `src/server/website.ts`.
- Fichiers a creer/modifier:
  - `src/app/catalogue/[[...segments]]/page.tsx`
  - `src/server/website.ts`
- Changements DB: Aucun.
- API/routes requises: Aucune.
- UI/ecrans impactes: Aucun.
- Criteres d acceptation (DoD):
  - [ ] Les pages produit ont un title/description specifique.
- Plan de test:
  - Manual: verifier metadata avec plusieurs paths.
- Risques et mitigation:
  - Surcout query: reutiliser cache `unstable_cache`.
- Effort estime: S/M.

## T7.2 - Ajouter sitemap/robots et optimisations perf

Status: ✅ Completed

- Objectif: Ajouter sitemap/robots et optimiser images/performances.
- Pourquoi: Necessaire pour indexation et experience mobile.
- Notes de decouverte du repo: pas de routes sitemap/robots dans `src/app`, pas de fichiers `public/robots.txt`.
- Details d implementation:
  - Ajouter `src/app/sitemap.ts` (Option A: pour URLs /catalogue/<slug> seulement).
  - Option B: endpoint parametre par domaine si besoin multi-tenant.
  - Ajouter `public/robots.txt` ou `src/app/robots.ts` selon strategie.
  - Optimiser images dans le template (utiliser `next/image` et placeholders existants).
- Fichiers a creer/modifier:
  - `src/app/sitemap.ts`
  - `public/robots.txt`
  - `src/components/website/templates/ecommerce-tech-agency.tsx`
- Changements DB: Aucun.
- API/routes requises:
  - Optionnel: `GET /api/sitemap?domain=` (Option B)
- UI/ecrans impactes: Aucun.
- Criteres d acceptation (DoD):
  - [ ] Un sitemap est disponible et valide.
  - [ ] Les images utilisent `next/image`.
- Plan de test:
  - Manual: verifier `sitemap.xml` et `robots.txt`.
- Risques et mitigation:
  - Multi-tenant sitemap: documenter la strategie et les limites.
- Effort estime: S/M.

## T8.1 - Ajouter la couverture de tests

Status: ✅ Completed

- Objectif: Couvrir les nouveaux flux commandes/devis/paiements.
- Pourquoi: Eviter regressions sur checkout et conversion devis.
- Notes de decouverte du repo: tests Vitest dans `tests/` (ex: `tests/quote-invoice.test.ts`, `tests/domain-verification.test.ts`).
- Details d implementation:
  - Ajouter tests pour `src/server/orders.ts` (creation, totals, status).
  - Ajouter tests pour `src/server/quote-requests.ts` (validation, conversion).
  - Ajouter tests pour routing par domaine (simulate `domain` param).
- Fichiers a creer/modifier:
  - `tests/orders.test.ts`
  - `tests/quote-requests.test.ts`
  - `tests/setup-test-env.ts`
- Changements DB: Aucun.
- API/routes requises: Aucune.
- UI/ecrans impactes: Aucun.
- Criteres d acceptation (DoD):
  - [ ] Les nouveaux modules sont couverts par des tests Vitest.
- Plan de test:
  - Unit + integration via `npm test`.
- Risques et mitigation:
  - Couplage DB: utiliser fixtures et seed minimal.
- Effort estime: M.

## T8.2 - Mettre a jour seed/migrations et checklist release

Status: ✅ Completed

- Objectif: Preparer les migrations et les donnees de demo.
- Pourquoi: Assurer un demarrage propre et une release sans erreur.
- Notes de decouverte du repo: seed dans `prisma/seed.ts`, migrations Prisma dans `prisma/migrations`.
- Details d implementation:
  - Mettre a jour `prisma/seed.ts` pour les nouveaux champs produit (`saleMode`, `publicSlug`, `excerpt`).
  - Ajouter un exemple `ecommerceSettings` dans `WebsiteConfig` seed.
  - Documenter la checklist release (migrations, `npm run prisma:generate`, `npm run build`).
- Checklist release:
  - [ ] Appliquer les migrations (`npm run prisma:migrate` en local ou `npm run prisma:deploy` en prod).
  - [ ] Regenerer le client Prisma (`npm run prisma:generate`).
  - [ ] Verifier le build (`npm run build`).
- Fichiers a creer/modifier:
  - `prisma/seed.ts`
  - `docs/plan-ecommerce-tech-agency-template.md`
- Changements DB:
  - Nouvelles migrations de T1.1/T1.2 a appliquer via `npm run prisma:migrate` ou `npm run prisma:deploy`.
- API/routes requises: Aucune.
- UI/ecrans impactes: Aucun.
- Criteres d acceptation (DoD):
  - [ ] Le seed passe sans erreur avec les nouveaux champs.
  - [ ] La checklist release est claire.
- Plan de test:
  - Manual: executer `npm run db:seed` en local.
- Risques et mitigation:
  - Migrations en conflit: isoler les changements ecommerce dans une migration dediee.
- Effort estime: S.
