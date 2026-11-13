# Database SQL Source Of Truth

This directory is the reviewed SQL source of truth for schema and index changes after the Prisma removal. Runtime model metadata still lives in `src/lib/db/generated-schema.ts`; when tables, columns, relations, enums, or constraints change, update that generated metadata in the same change as the reviewed SQL.

## Files

- `20260411_db_optimization.sql` is the one-off post-migration cleanup and background job event index fix.
- `20260413_performance_index_baseline.sql` is the maintained performance index baseline for the current direct Postgres query paths.
- `20260414_product_reviews.sql` adds moderated product reviews for public catalogue product pages.
- `20260414_site_reviews.sql` adds moderated general site reviews for Home/About testimonials.
- `20260417_invoice_requests.sql` adds tenant-scoped customer invoice requests for catalogue orders.
- `20260430_messaging_auto_forwarding.sql` adds tenant-scoped Messagerie auto-forward settings, cursor state, and delivery logs.
- `20261109_external_invoice_requests.sql` adds the PrestaShop invoice API tables (`IntegrationRequestNonce` for replay protection and rate limiting, `ExternalInvoiceRequest` for per-order idempotency). Additive, transactional and idempotent; `20261109_external_invoice_requests_rollback.sql` drops only these tables. See `docs/PRESTASHOP_INVOICE_API.md`.
- `20261110_digital_licences.sql` adds the Produits Digitaux tables (`DigitalLicenceCode` encrypted activation-code inventory, `DigitalLicenceOrder` licence documents with idempotency and future PrestaShop/invoice links, `DigitalLicenceEvent` audit trail). Additive, transactional and idempotent; requires `20261109_external_invoice_requests.sql` for the licence API nonces. `20261110_digital_licences_rollback.sql` drops these tables **and the stored codes**. See `docs/DIGITAL_LICENCE_API.md`.
- `20261113_digital_order_fulfilment.sql` adds `DigitalOrderFulfilment` (one row per PrestaShop order: licences + invoice + one customer e-mail) and normalises early `DigitalLicenceEvent.details` stored as JSON strings. Additive, transactional and idempotent; requires the two migrations above. The rollback drops only the tracking table.

## Applying

Run reviewed SQL with the Supabase direct/session pooler URL, not the transaction pooler:

```sh
psql "$DIRECT_URL" -f scripts/sql/20260413_performance_index_baseline.sql
```

The index baseline intentionally uses `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, so keep `psql` in autocommit mode and do not wrap it in a transaction.

## Verifying

Rerun `20260413_performance_index_baseline.sql` after deployment. The final `expected_indexes` query returns the required index names and an `installed` flag, including the `BackgroundJobEvent_createdAt_idx` index introduced by `20260411_db_optimization.sql`.

When adding new hot query paths, add the SQL index here first, keep the change data-preserving, and update tests that guard the baseline.

### Three-decimal document inputs

First deploy a **compatibility-only** adapter release that converts NUMERIC
results to JavaScript numbers, while retaining the old input precision. Confirm
every active instance uses it. Then apply `20261106_document_input_precision.sql`
after a complete backup has passed a restore test. Enable the three-decimal
inputs only after migration integrity checks pass. It widens invoice/quote unit prices and fixed discounts to
`numeric(14,3)` without rescaling existing minor-unit values. Percentage columns
already support fractional values; totals and payments stay integer minor units.
The migration is transactional and idempotent. PostgreSQL takes table locks for
the type changes, so schedule it appropriately for large tables. Do not downgrade
these columns to integers after recording fractional minor units.


The migration uses a 2-second lock timeout and a 30-second statement timeout;
it aborts instead of waiting indefinitely for production table locks. The
`20261106_document_input_precision_rollback.sql` rollback must be rehearsed on the
restored backup first. It rejects rollback if any amount contains fractional
minor units or exceeds the old integer range, preserving the original values.
If fractional inputs have been saved, retain the widened columns and deploy the
compatible adapter while diagnosing the issue; never cast away fractional data.
