-- Production-safe index rollout for the live Supabase database.
-- Run with psql in autocommit mode:
--   psql "$DIRECT_URL" -f scripts/sql/20260413_live_index_rollout.sql
--
-- Notes:
-- - This rollout only creates indexes that are genuinely missing on the live
--   database.
-- - Equivalent legacy indexes already exist for:
--   * MessagingLocalMessage_searchText_tsv_idx
--   * MessagingLocalMessage_searchText_trgm_idx
--   * Product_name_trgm_idx
--   * Product_sku_trgm_idx
--   * Session_activeTenantId_idx
--   * BackgroundJobEvent_createdAt_idx

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Messaging local sync mailbox scans and per-mailbox incremental reads.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_user_mailbox_date_uid_idx"
  ON public."MessagingLocalMessage" ("userId", "mailbox", "internalDate" DESC, "uid" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_user_mailbox_uidValidity_date_uid_idx"
  ON public."MessagingLocalMessage" ("userId", "mailbox", "uidValidity", "internalDate" DESC, "uid" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MessagingLocalMessage_user_mailbox_uid_uidValidity_idx"
  ON public."MessagingLocalMessage" ("userId", "mailbox", "uid", "uidValidity" DESC, "id" DESC);

-- Product listings, category filters, and catalog/admin sorting.
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

-- Order dashboards, list filters, and text search.
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

-- Order-payment filters and latest-payment lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPayment_user_method_idx"
  ON public."OrderPayment" ("userId", "method");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPayment_order_created_idx"
  ON public."OrderPayment" ("orderId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "OrderPayment_order_method_created_idx"
  ON public."OrderPayment" ("orderId", "method", "createdAt" DESC);

-- Session cleanup and lookups.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_userId_idx"
  ON public."Session" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_expiresAt_idx"
  ON public."Session" ("expiresAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClientSession_expiresAt_idx"
  ON public."ClientSession" ("expiresAt");

-- Background job leasing and retention.
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

ANALYZE public."MessagingLocalMessage";
ANALYZE public."Product";
ANALYZE public."Order";
ANALYZE public."OrderPayment";
ANALYZE public."Session";
ANALYZE public."ClientSession";
ANALYZE public."BackgroundJob";
