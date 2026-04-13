import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const baselinePath = join(
  process.cwd(),
  "scripts/sql/20260413_performance_index_baseline.sql",
);
const baselineSql = readFileSync(baselinePath, "utf8");

const requiredIndexes = [
  "MessagingLocalMessage_user_mailbox_date_uid_idx",
  "MessagingLocalMessage_user_mailbox_uidValidity_date_uid_idx",
  "MessagingLocalMessage_user_mailbox_uid_uidValidity_idx",
  "MessagingLocalMessage_searchText_fts_idx",
  "MessagingLocalMessage_searchText_trgm_idx",
  "Product_catalog_active_category_name_idx",
  "Product_catalog_updated_idx",
  "Product_name_trgm_idx",
  "Product_sku_trgm_idx",
  "Product_user_active_category_name_id_idx",
  "Product_user_category_idx",
  "Product_user_name_id_idx",
  "Order_orderNumber_trgm_idx",
  "Order_customerName_trgm_idx",
  "Order_customerEmail_trgm_idx",
  "Order_user_created_id_idx",
  "Order_user_status_created_id_idx",
  "Order_user_paymentStatus_created_id_idx",
  "Order_user_client_created_id_idx",
  "OrderPayment_user_method_idx",
  "OrderPayment_order_created_idx",
  "OrderPayment_order_method_created_idx",
  "Session_userId_idx",
  "Session_activeTenantId_idx",
  "Session_expiresAt_idx",
  "ClientSession_clientId_idx",
  "ClientSession_expiresAt_idx",
  "BackgroundJob_status_idx",
  "BackgroundJob_pending_lease_idx",
  "BackgroundJob_pending_type_lease_idx",
  "BackgroundJob_running_lockedAt_idx",
  "BackgroundJob_terminal_completedAt_idx",
  "BackgroundJobEvent_createdAt_idx",
];

describe("database performance index baseline", () => {
  it("tracks required indexes for hot direct Postgres query paths", () => {
    for (const indexName of requiredIndexes) {
      expect(baselineSql).toContain(`"${indexName}"`);
      expect(baselineSql).toContain(`('${indexName}')`);
    }
  });

  it("keeps production index rollout idempotent and data-preserving", () => {
    expect(baselineSql).toContain("CREATE INDEX CONCURRENTLY IF NOT EXISTS");
    expect(baselineSql).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(baselineSql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE)\b/i);
  });

  it("verifies the one-off background job event index from 20260411", () => {
    expect(baselineSql).toContain('"BackgroundJobEvent_createdAt_idx"');
    expect(baselineSql).toContain("reports installed = true");
  });
});
