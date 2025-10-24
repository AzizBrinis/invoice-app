# Audit Remediation Task List

The following prioritized tasks consolidate all issues, errors, and recommendations documented in `/audit`.

## Critical Priority
| Title | Category | Severity | Description | References |
| --- | --- | --- | --- | --- |
| Preserve Tunisian millimes across storage and outputs | Calculation | Critical | Monetary helpers clamp values to 2 decimals, truncating millimes and corrupting downstream totals in storage, exports, and reports. Remove the hard 2-decimal cap and propagate 3-decimal support everywhere amounts are formatted. | 【F:audit/fr-tn-audit.md†L6-L6】【F:audit/fr-tn-audit.md†L27-L27】 |
| ✅ Fix percentage formatter scaling | Calculation/UI | Critical | `formatPercent` interprets `7` as `700%`, overstating VAT in UI, PDFs, and emails. Update the formatter to treat whole-number inputs as percentages. | 【F:audit/fr-tn-audit.md†L7-L7】【F:audit/fr-tn-audit.md†L28-L28】 |

## High Priority
| Title | Category | Severity | Description | References |
| --- | --- | --- | --- | --- |
| Enforce authentication/authorization on billing actions | Security | High | Server actions for invoices, payments, and mailers run without session or role checks, allowing unauthenticated mutations. Introduce `requireUser` guards and role-based authorization. | 【F:audit/fr-tn-audit.md†L8-L8】【F:audit/fr-tn-audit.md†L29-L29】 |
| Reject negative discounts in totals | Calculation | High | `calculateLineTotals` allows negative discount amounts, inflating taxable bases and VAT. Clamp discounts to non-negative ranges and validate inputs. | 【F:audit/fr-tn-audit.md†L9-L9】【F:audit/fr-tn-audit.md†L30-L30】 |
| Prevent destructive deletion of published invoices | Compliance | High | `deleteInvoice` erases issued invoices without status checks, breaking fiscal immutability. Block deletion post-publication and add non-destructive cancellation/audit logging. | 【F:audit/fr-tn-audit.md†L10-L10】【F:audit/fr-tn-audit.md†L31-L31】 |

## Medium Priority
| Title | Category | Severity | Description | References |
| --- | --- | --- | --- | --- |
| ✅ Make FODEC and stamp duties conditional | Tax rule | Medium | Default tax configuration applies 1% FODEC and 1 TND stamp to all documents, including exempt services and exports. Allow per-line/document configuration and disable by default where not applicable. | 【F:audit/fr-tn-audit.md†L11-L11】【F:audit/fr-tn-audit.md†L32-L32】 |
| ✅ Localize analytics to Africa/Tunis timezone | Reporting | Medium | Dashboard aggregates rely on UTC dates, skewing monthly figures versus Tunisian legal time. Use timezone-aware conversions for analytics and history views. | 【F:audit/fr-tn-audit.md†L12-L12】【F:audit/fr-tn-audit.md†L33-L33】 |
| Stabilize PDF generation infrastructure | Operations | Medium | Headless Chrome fails in production due to missing system libs (`libatk`), causing silent PDF generation errors. Bundle dependencies, switch renderer, or add failure alerts. | 【F:audit/fr-tn-audit.md†L13-L13】【F:audit/fr-tn-audit.md†L34-L34】【F:audit/samples/pdf-generation-error.txt†L1-L10】 |
| Display millimes in PDFs and exports | UI/Reporting | Medium | Document rendering forces two decimals, hiding millimes even when stored correctly and truncating CSV/PDF outputs. Respect currency precision when formatting. | 【F:audit/fr-tn-audit.md†L14-L14】【F:audit/fr-tn-audit.md†L27-L27】【F:audit/samples/factures.csv†L1-L3】 |

## Test Coverage Improvements
| Title | Category | Severity | Description | References |
| --- | --- | --- | --- | --- |
| Extend unit tests for money & tax rounding | Testing | Medium | Add reference cases for 3-decimal TND amounts, stamp duty, conditional FODEC, and mixed HT/TVA calculations to lock regression fixes. | 【F:audit/fr-tn-audit.md†L19-L19】 |
| Harden workflow status transitions | Testing | Medium | Introduce unit tests guarding against deletion of issued invoices and covering partial/late payment transitions. | 【F:audit/fr-tn-audit.md†L20-L20】 |
| Restore integration coverage for document exports | Testing | Medium | Re-enable PDF/document integration tests using a supported headless engine and validate Tunisian legal mentions plus millime rounding. | 【F:audit/fr-tn-audit.md†L21-L21】 |
| Add end-to-end Playwright scenarios | Testing | Medium | Create E2E flows for authentication, CRUD on master data, quote-to-invoice conversion, partial payments, and CSV exports. | 【F:audit/fr-tn-audit.md†L22-L22】 |
| Introduce property-based tests for rounding | Testing | Low | Generate random monetary inputs to verify millime handling and discount distribution robustness. | 【F:audit/fr-tn-audit.md†L23-L23】 |
| Apply mutation testing to tax rules | Testing | Low | Run mutation tests focused on `documents.ts` and `taxes.ts` to ensure the corrected fiscal formulas remain protected. | 【F:audit/fr-tn-audit.md†L24-L24】 |

