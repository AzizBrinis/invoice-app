import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DIGITAL_PRODUCT_SKUS } from "@/lib/digital-products/catalog";
import { MAX_LICENCE_QUANTITY } from "@/lib/digital-products/kaspersky-catalog";
import { loadLicenceApiConfig } from "@/server/digital-products/api-config";
import {
  authenticateLicenceApiRequest,
  baseHeaders,
  errorResponse,
  type LicenceApiDeps,
  type LogFields,
} from "@/server/digital-products/api";
import { getLicenceInventoryCounts } from "@/server/digital-products/store";
import { safeErrorName } from "@/server/integrations/prestashop/service";
import { postgresPrestashopInvoiceStore } from "@/server/integrations/prestashop/store";

/**
 * Signed, server-to-server licence stock lookup (DPLIC1, same keys as the
 * licence API).
 *
 *   POST /api/integrations/digital-products/stock
 *   { "schemaVersion": 1, "skus": ["idm-1p-1y", …] }
 *
 * Lets the shop show "Livraison instantanée" only when the requested quantity
 * can be delivered. Answers the number of AVAILABLE codes per SKU, capped at
 * the per-request maximum (MAX_LICENCE_QUANTITY): the exact stock level is
 * never exposed, and no code (not even masked) leaves the service.
 */

export const licenceStockPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    skus: z.array(z.enum(DIGITAL_PRODUCT_SKUS)).min(1).max(DIGITAL_PRODUCT_SKUS.length),
  })
  .strict();

export type LicenceStockDeps = Pick<LicenceApiDeps, "loadConfig" | "nonces" | "random" | "log"> & {
  getInventoryCounts: typeof getLicenceInventoryCounts;
};

const defaultDeps: LicenceStockDeps = {
  loadConfig: () => loadLicenceApiConfig(),
  nonces: postgresPrestashopInvoiceStore,
  random: Math.random,
  getInventoryCounts: getLicenceInventoryCounts,
  log: (level, event, fields) => console[level]("[digital-licence-stock]", { event, ...fields }),
};

export async function handleLicenceStockRequest(
  request: Request,
  overrides: Partial<LicenceStockDeps> = {},
): Promise<Response> {
  const deps: LicenceStockDeps = { ...defaultDeps, ...overrides };
  const requestId = randomUUID();
  const logContext: LogFields = { requestId };
  const log = (level: "info" | "warn" | "error", event: string, fields: LogFields = {}) =>
    deps.log(level, event, { ...logContext, ...fields });

  const auth = await authenticateLicenceApiRequest(request, deps, { requestId, log, logContext });
  if ("response" in auth) return auth.response;

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(auth.rawBody));
  } catch {
    return errorResponse(requestId, 400, "INVALID_JSON", "Corps JSON invalide.");
  }
  const parsed = licenceStockPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(requestId, 422, "VALIDATION_FAILED", "Données invalides.", {
      details: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  let rows;
  try {
    rows = await deps.getInventoryCounts(auth.config.tenantUserId);
  } catch (error) {
    log("error", "stock_failed", { error: safeErrorName(error) });
    return errorResponse(requestId, 500, "INTERNAL_ERROR", "Erreur interne.");
  }

  const skus = [...new Set(parsed.data.skus)];
  const stock = skus.map((sku) => {
    const available = rows
      .filter((row) => row.productSku === sku && row.status === "AVAILABLE")
      .reduce((sum, row) => sum + row.count, 0);
    return { sku, available: Math.min(available, MAX_LICENCE_QUANTITY) };
  });

  return Response.json(
    { requestId, maxQuantity: MAX_LICENCE_QUANTITY, stock },
    { status: 200, headers: baseHeaders(requestId) },
  );
}
