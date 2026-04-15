# Database SQL Source Of Truth

This directory is the reviewed SQL source of truth for schema and index changes after the Prisma removal. Runtime model metadata still lives in `src/lib/db/generated-schema.ts`; when tables, columns, relations, enums, or constraints change, update that generated metadata in the same change as the reviewed SQL.

## Files

- `20260411_db_optimization.sql` is the one-off post-migration cleanup and background job event index fix.
- `20260413_performance_index_baseline.sql` is the maintained performance index baseline for the current direct Postgres query paths.
- `20260414_product_reviews.sql` adds moderated product reviews for public catalogue product pages.
- `20260414_site_reviews.sql` adds moderated general site reviews for Home/About testimonials.

## Applying

Run reviewed SQL with the Supabase direct/session pooler URL, not the transaction pooler:

```sh
psql "$DIRECT_URL" -f scripts/sql/20260413_performance_index_baseline.sql
```

The index baseline intentionally uses `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, so keep `psql` in autocommit mode and do not wrap it in a transaction.

## Verifying

Rerun `20260413_performance_index_baseline.sql` after deployment. The final `expected_indexes` query returns the required index names and an `installed` flag, including the `BackgroundJobEvent_createdAt_idx` index introduced by `20260411_db_optimization.sql`.

When adding new hot query paths, add the SQL index here first, keep the change data-preserving, and update tests that guard the baseline.
