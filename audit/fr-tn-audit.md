# Audit fonctionnel et fiscal – Application de facturation fr-TN

## 1. Liste priorisée des anomalies
| Priorité | Problème | Reproduction | Preuves |
| --- | --- | --- | --- |
| Critique | Perte systématique des millimes tunisiens : la conversion vers les "cents" impose 2 décimales maximum, ce qui tronque les montants TND à 3 décimales et cascade dans tous les calculs et exports. | Créer ou éditer un produit à 1,234 TND et constater qu'il est stocké à 1,23 TND. Le test `loses tunisian millimes` illustre le défaut. | `storageDecimals` borne la précision à 2 décimales.【F:src/lib/money.ts†L14-L38】 • Test de reproduction.【F:tests/audit-findings.test.ts†L1-L26】 |
| Critique | Formatage des pourcentages erroné : `formatPercent` traite `7` comme 700 %, produisant des totaux TVA faux dans l'UI/PDF/emails. | Afficher une TVA à 7 % (produit ou ligne) → rendu "700 %" dans l'interface/PDF. | Implémentation fautive.【F:src/lib/formatters.ts†L22-L32】 • Test de reproduction.【F:tests/audit-findings.test.ts†L13-L16】 |
| Élevée | Les actions serveur sensibles (création/modification/suppression de factures, enregistrement paiements, envoi d'e-mails) n'appliquent aucune vérification de session/autorisation. | Appeler directement les actions `/factures` via une requête POST forgée sans cookie authentifié : l'action s'exécute quand même. | Aucune vérification utilisateur dans les actions serveur.【F:src/app/(app)/factures/actions.ts†L1-L114】 |
| Élevée | Remises négatives acceptées : `calculateLineTotals` ne borne pas la remise à 0 et additionne les remises négatives, gonflant les montants HT/TVA. | Créer une ligne avec `discountAmountCents = -100` → total HT augmente. | Calcul sans clamp positif.【F:src/lib/documents.ts†L71-L109】 • Test `accepts negative discounts`.【F:tests/audit-findings.test.ts†L18-L26】 |
| Élevée | Suppression libre des factures publiées : `deleteInvoice` supprime sans vérifier le statut, ce qui viole l'immutabilité fiscale après émission. | Supprimer une facture `ENVOYEE/PAYEE` via l'UI → données effacées. | Implémentation sans garde.【F:src/server/invoices.ts†L419-L423】 |
| Moyenne | Configuration fiscale par défaut applique FODEC (1 %) et timbre (1 TND) à toutes les lignes sans condition (services, export, exonérations) provoquant des factures illégales. | Créer un devis pour un service → FODEC et timbre ajoutés automatiquement. | Valeurs par défaut activées et auto-appliquées.【F:src/lib/taxes.ts†L37-L186】【F:src/lib/documents.ts†L158-L213】 |
| Moyenne | Tableau de bord calculé en fuseau UTC : l'utilisation de `new Date()`/`date-fns` sans fuseau `Africa/Tunis` fausse les rapports mensuels et l'historique. | Comparer chiffres au changement de mois (UTC vs Tunis). | Calculs calendrier sans fuseau local.【F:src/server/analytics.ts†L1-L118】 |
| Moyenne | Génération PDF instable en production : dépendances système (libatk…) manquantes provoquent un échec silencieux. | Lancer `generateInvoicePdf` sur l'infra dépourvue de librairies → erreur 127, fichier absent. | Log d'échec capturé.【F:audit/samples/pdf-generation-error.txt†L1-L10】 |
| Moyenne | Les PDFs et exports numériques utilisent 2 décimales fixes (`formatNumber`), masquant les millimes TND même si les données étaient correctes. | Lire une facture PDF : les montants sont arrondis à 0,00 DT. | Formatage 2 décimales imposé.【F:src/server/pdf.ts†L58-L64】 • Exemple CSV avec montants tronqués.【F:audit/samples/factures.csv†L1-L3】 |

## 2. Matrice de tests
| Type | Domaine | Couverture actuelle | Lacunes identifiées |
| --- | --- | --- | --- |
| Unitaire | Conversion monétaire, formatage fiscal | Nouveaux tests d'audit pour conversions/percentages (voir `tests/audit-findings.test.ts`). | Ajouter tests de référence 3 décimales, timbre, FODEC conditionnelle, calculs HT/TVA mixtes. |
| Unitaire | Statuts et transitions | `tests/quote-invoice.test.ts` couvre numérotation et conversion devis→facture. | Tests pour interdiction suppression factures émises, transitions paiements partiels/retards. |
| Intégration | Génération documents & exports | `tests/documents.test.ts`, `tests/pdf.test.ts` (partiellement skippé). | Activer tests PDF via moteur headless supporté, vérifier présence mentions légales TN, millimes, timbre export. |
| E2E | Auth, navigation App Router | Aucun flux complet automatisé détecté. | Ajouter scénarios Playwright: login, CRUD clients/produits, devis→facture, paiement partiel, export CSV. |
| Property-based | Rounding & répartition discounts | Aucun. | Générer montants aléatoires pour valider arrondis ligne/document (millimes). |
| Mutation | Règles fiscales (FODEC, timbre, TVA) | Aucun. | Introduire mutation testing ciblé sur `documents.ts`/`taxes.ts` pour sécuriser formules. |

## 3. Pistes de correctifs
- Autoriser 3 décimales pour TND : retirer le `Math.min(..., 2)` et stocker la précision réelle ; propager aux formatteurs (utiliser `info.decimals`).【F:src/lib/money.ts†L14-L38】【F:src/server/pdf.ts†L58-L64】
- Corriger `formatPercent` pour accepter des pourcentages (diviser par 100 ou utiliser `style: "decimal"`).【F:src/lib/formatters.ts†L22-L32】
- Ajouter des gardes d'authentification (`requireUser`) et contrôles d'autorisation rôle par rôle dans toutes les actions serveur (factures, devis, produits, clients, e-mails).【F:src/app/(app)/factures/actions.ts†L1-L114】
- Clamper les remises à `[0, baseAmount]` et valider côté schéma que `discountAmountCents` ne peut être négatif ; recalculer la TVA sur montants nets.【F:src/lib/documents.ts†L71-L109】
- Interdire `deleteInvoice` pour les factures non brouillon, implémenter un statut `ANNULEE` non destructif et historiser la suppression (journal d'audit).【F:src/server/invoices.ts†L419-L429】
- Rendre FODEC/Timbre configurables par ligne/document (type produit, destination export) et désactiver par défaut pour les services ; appliquer la logique d'exemption export.【F:src/lib/taxes.ts†L37-L186】【F:src/lib/documents.ts†L158-L213】
- Utiliser `zonedTimeToUtc`/`utcToZonedTime` avec `Africa/Tunis` dans les agrégats analytiques et dans le calcul de l'historique pour fiabilité fiscale.【F:src/server/analytics.ts†L1-L118】
- Fournir une alternative de rendu PDF (Playwright + bundle dépendances, ou service distant) et un mécanisme de détection/alerte en cas d'échec.【F:audit/samples/pdf-generation-error.txt†L1-L10】

## 4. Tests & journaux collectés
- ✅ `npx prisma migrate deploy` (initialisation SQLite).【4e9d92†L1-L23】
- ✅ `npm run db:seed` (jeu de données démonstration).【672871†L1-L2】
- ✅ `npm test` (inclut `tests/audit-findings.test.ts`).【c731dd†L1-L32】
- ⚠️ `npx tsx audit/scripts/generate-samples.ts` (génération PDF échouée faute de dépendances système, CSV/e-mails produits).【de7970†L1-L1】【ec9dfa†L1-L10】

## 5. Échantillons d'exports
- CSV factures/fr-TN (séparateur `;`, montants formatés) généré depuis l'application.【F:audit/samples/factures.csv†L1-L3】
- Courriels de facture et devis préformatés montrant les placeholders et montants calculés.【F:audit/samples/facture-FAC-2025-0001-email.txt†L1-L9】【F:audit/samples/devis-DEV-2025-0001-email.txt†L1-L9】
- Journal d'échec de génération PDF documentant la dépendance manquante (`libatk`).【F:audit/samples/pdf-generation-error.txt†L1-L10】

