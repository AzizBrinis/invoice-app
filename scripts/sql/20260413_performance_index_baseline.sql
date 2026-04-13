-- Maintained performance index baseline for the direct Postgres database layer.
-- Run with psql in autocommit mode because CREATE INDEX CONCURRENTLY cannot run
-- inside an explicit transaction:
--   psql "$DIRECT_URL" -f scripts/sql/20260413_performance_index_baseline.sql

-- Needed by the ILIKE fallback paths on mailbox and product/order search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Messaging local mailbox listing, UID lookups, sync hydration, and local search.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_user_mailbox_date_uid_idx"
  ON public."MessagingLocalMessage" ("userId", "mailbox", "internalDate" DESC, "uid" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_user_mailbox_uidValidity_date_uid_idx"
  ON public."MessagingLocalMessage" ("userId", "mailbox", "uidValidity", "internalDate" DESC, "uid" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_user_mailbox_uid_uidValidity_idx"
  ON public."MessagingLocalMessage" ("userId", "mailbox", "uid", "uidValidity" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_searchText_fts_idx"
  ON public."MessagingLocalMessage"
  USING GIN (to_tsvector('simple', COALESCE("searchText", '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_searchText_trgm_idx"
  ON public."MessagingLocalMessage"
  USING GIN ((COALESCE("searchText", '')) gin_trgm_ops);

-- Catalog/admin product listings, category filters, public catalog payloads, and
-- website product summaries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_user_name_id_idx"
  ON public."Product" ("userId", "name" ASC, "id" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_user_category_idx"
  ON public."Product" ("userId", "category" ASC)
  WHERE "category" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_user_active_category_name_id_idx"
  ON public."Product" ("userId", "isActive", "category" ASC, "name" ASC, "id" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_catalog_active_category_name_idx"
  ON public."Product" ("userId", "isListedInCatalog", "isActive", "category" ASC, "name" ASC, "id" ASC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_catalog_updated_idx"
  ON public."Product" ("userId", "isListedInCatalog", "updatedAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_name_trgm_idx"
  ON public."Product" USING GIN ("name" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_sku_trgm_idx"
  ON public."Product" USING GIN ("sku" gin_trgm_ops);

-- Order list pagination, status filters, client/date filters, payment-method
-- filters, and latest payment/proof reads.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_user_created_id_idx"
  ON public."Order" ("userId", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_user_status_created_id_idx"
  ON public."Order" ("userId", "status", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_user_paymentStatus_created_id_idx"
  ON public."Order" ("userId", "paymentStatus", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_user_client_created_id_idx"
  ON public."Order" ("userId", "clientId", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_orderNumber_trgm_idx"
  ON public."Order" USING GIN ("orderNumber" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_customerName_trgm_idx"
  ON public."Order" USING GIN ("customerName" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_customerEmail_trgm_idx"
  ON public."Order" USING GIN ("customerEmail" gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPayment_user_method_idx"
  ON public."OrderPayment" ("userId", "method");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPayment_order_created_idx"
  ON public."OrderPayment" ("orderId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPayment_order_method_created_idx"
  ON public."OrderPayment" ("orderId", "method", "createdAt" DESC);

-- Session cleanup and relation hydration. Token hashes are already unique.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_userId_idx"
  ON public."Session" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_activeTenantId_idx"
  ON public."Session" ("activeTenantId")
  WHERE "activeTenantId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_expiresAt_idx"
  ON public."Session" ("expiresAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClientSession_clientId_idx"
  ON public."ClientSession" ("clientId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClientSession_expiresAt_idx"
  ON public."ClientSession" ("expiresAt");

-- Background job leasing, metrics, stale lease recovery, history pruning, and
-- latest event reads. The event index is reasserted from 20260411 for rollout
-- verification.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BackgroundJob_status_idx"
  ON public."BackgroundJob" ("status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "BackgroundJob_pending_lease_idx"
  ON public."BackgroundJob" ("priority" DESC, "runAt" ASC, "createdAt" ASC)
  WHERE "status" = 'PENDING';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "BackgroundJob_pending_type_lease_idx"
  ON public."BackgroundJob" ("type", "priority" DESC, "runAt" ASC, "createdAt" ASC)
  WHERE "status" = 'PENDING';

CREATE INDEX CONCURRENTLY IF NOT EXISTS "BackgroundJob_running_lockedAt_idx"
  ON public."BackgroundJob" ("lockedAt" ASC)
  WHERE "status" = 'RUNNING' AND "lockedAt" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "BackgroundJob_terminal_completedAt_idx"
  ON public."BackgroundJob" ("completedAt" ASC)
  WHERE "status" IN ('SUCCEEDED', 'FAILED', 'CANCELLED') AND "completedAt" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "BackgroundJobEvent_createdAt_idx"
  ON public."BackgroundJobEvent" ("createdAt" DESC);

-- Deployment verification. Rerun after production apply and confirm every row
-- reports installed = true.
WITH expected_indexes(index_name) AS (
  VALUES
    ('MessagingLocalMessage_user_mailbox_date_uid_idx'),
    ('MessagingLocalMessage_user_mailbox_uidValidity_date_uid_idx'),
    ('MessagingLocalMessage_user_mailbox_uid_uidValidity_idx'),
    ('MessagingLocalMessage_searchText_fts_idx'),
    ('MessagingLocalMessage_searchText_trgm_idx'),
    ('Product_user_name_id_idx'),
    ('Product_user_category_idx'),
    ('Product_user_active_category_name_id_idx'),
    ('Product_catalog_active_category_name_idx'),
    ('Product_catalog_updated_idx'),
    ('Product_name_trgm_idx'),
    ('Product_sku_trgm_idx'),
    ('Order_user_created_id_idx'),
    ('Order_user_status_created_id_idx'),
    ('Order_user_paymentStatus_created_id_idx'),
    ('Order_user_client_created_id_idx'),
    ('Order_orderNumber_trgm_idx'),
    ('Order_customerName_trgm_idx'),
    ('Order_customerEmail_trgm_idx'),
    ('OrderPayment_user_method_idx'),
    ('OrderPayment_order_created_idx'),
    ('OrderPayment_order_method_created_idx'),
    ('Session_userId_idx'),
    ('Session_activeTenantId_idx'),
    ('Session_expiresAt_idx'),
    ('ClientSession_clientId_idx'),
    ('ClientSession_expiresAt_idx'),
    ('BackgroundJob_status_idx'),
    ('BackgroundJob_pending_lease_idx'),
    ('BackgroundJob_pending_type_lease_idx'),
    ('BackgroundJob_running_lockedAt_idx'),
    ('BackgroundJob_terminal_completedAt_idx'),
    ('BackgroundJobEvent_createdAt_idx')
)
SELECT
  expected_indexes.index_name,
  pg_indexes.indexname IS NOT NULL AS installed
FROM expected_indexes
LEFT JOIN pg_indexes
  ON pg_indexes.schemaname = 'public'
  AND pg_indexes.indexname = expected_indexes.index_name
ORDER BY expected_indexes.index_name;
