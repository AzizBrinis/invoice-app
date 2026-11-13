import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateId } from "@/lib/id";
import {
  getKasperskyVariant,
  KASPERSKY_SKUS,
  KASPERSKY_VARIANTS,
  LICENCE_CODE_STATUSES,
  MAX_LICENCE_QUANTITY,
  type KasperskyVariant,
  type LicenceCodeStatus,
  type LicenceOrderSource,
} from "@/lib/digital-products/kaspersky-catalog";
import {
  licenceCodeHint,
  parseLicenceCodeInput,
} from "@/lib/digital-products/licence-code-format";
import {
  assertLicenceEncryptionConfigured,
  decryptLicenceCode,
  encryptLicenceCode,
  fingerprintLicenceCode,
  LICENCE_KEY_VERSION,
} from "@/server/digital-products/licence-crypto";
import {
  buildKasperskyLicenceHtml,
  DEFAULT_SELLER_BRANDING,
  type LicenceSellerBranding,
} from "@/server/digital-products/kaspersky-licence-html";
import {
  createLicenceOrderWithAllocation,
  getLicenceInventoryCounts,
  getLicenceOrder,
  getOrderCodeCiphertexts,
  insertLicenceCodes,
  markLicenceOrderGenerated,
  recordLicenceOrderFailure,
  type CreateLicenceOrderResult,
  type LicenceOrderRecord,
} from "@/server/digital-products/store";
import { renderPdfFromHtml } from "@/server/pdf";

/**
 * Digital licence business logic shared by the admin UI (server actions /
 * session routes) and the signed programmatic API. Future PrestaShop order
 * sync, e-mail delivery and invoicing should call `requestLicenceDocument`
 * and `renderLicenceOrderPdf` rather than touching the store directly.
 */

export class LicenceValidationError extends Error {
  constructor(message: string, public readonly issues: { path: string; message: string }[] = []) {
    super(message);
    this.name = "LicenceValidationError";
  }
}

export class LicenceOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenceOrderStateError";
  }
}

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  // Never log codes, ciphertexts or customer e-mails.
  console[level]("[digital-licences]", { event, ...fields });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .nullable()
    .transform((value) => (value ? value.replace(/[\u0000-\u001f\u007f]/g, " ") : null));

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ).")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day &&
      year >= 2000 &&
      year <= 2100
    );
  }, "Date invalide.");

export const licenceRequestSchema = z.object({
  sku: z.enum(KASPERSKY_SKUS, { message: "Produit inconnu." }),
  quantity: z.coerce
    .number({ message: "Quantité invalide." })
    .int("Quantité invalide.")
    .min(1, "La quantité minimale est 1.")
    .max(MAX_LICENCE_QUANTITY, `La quantité maximale est ${MAX_LICENCE_QUANTITY}.`),
  customerName: optionalText(120),
  customerEmail: z
    .string()
    .trim()
    .max(254)
    .email("Adresse e-mail invalide.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null))
    .transform((value) => (value ? value.toLowerCase() : null)),
  orderReference: optionalText(64),
  activationRegion: optionalText(60),
  useBefore: isoDate.optional().nullable().or(z.literal("").transform(() => null)),
  notes: optionalText(500),
});

export type LicenceRequestInput = z.input<typeof licenceRequestSchema>;
export type LicenceRequest = z.output<typeof licenceRequestSchema>;

export function parseLicenceRequest(input: unknown): LicenceRequest {
  const parsed = licenceRequestSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new LicenceValidationError(issues[0]?.message ?? "Données invalides.", issues);
  }
  return parsed.data;
}

/** Stable hash of the business content of a request (idempotency check). */
export function hashLicenceRequest(
  request: LicenceRequest,
  external?: { source?: string | null; orderId?: string | null; lineId?: string | null } | null,
) {
  const canonical = JSON.stringify([
    request.sku,
    request.quantity,
    request.customerName ?? null,
    request.customerEmail ?? null,
    request.orderReference ?? null,
    request.activationRegion ?? null,
    request.useBefore ?? null,
    external?.source ?? null,
    external?.orderId ?? null,
    external?.lineId ?? null,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export type LicenceImportSummary = {
  sku: string;
  submitted: number;
  imported: number;
  /** Already stored (any variant / status). */
  alreadyStored: number;
  /** Repeated inside the submitted text. */
  duplicateLines: number[];
  invalidLines: number[];
};

export async function importLicenceCodes(params: {
  tenantId: string;
  actorUserId: string;
  sku: string;
  text: string;
  batchLabel?: string | null;
}): Promise<LicenceImportSummary> {
  const variant = getKasperskyVariant(params.sku);
  if (!variant) throw new LicenceValidationError("Produit inconnu.");
  assertLicenceEncryptionConfigured();

  const parsed = parseLicenceCodeInput(params.text);
  const batchLabel = params.batchLabel?.trim().slice(0, 80) || null;

  const rows = parsed.valid.map(({ code }) => {
    const id = generateId("dlcode");
    return {
      id,
      ciphertext: encryptLicenceCode({ tenantId: params.tenantId, codeId: id, code }),
      fingerprint: fingerprintLicenceCode(params.tenantId, code),
      hint: licenceCodeHint(code),
      keyVersion: LICENCE_KEY_VERSION,
    };
  });

  const inserted = await insertLicenceCodes({
    tenantId: params.tenantId,
    productSku: variant.sku,
    rows,
    batchLabel,
    importedById: params.actorUserId,
    actor: `user:${params.actorUserId}`,
  });

  const summary: LicenceImportSummary = {
    sku: variant.sku,
    submitted: parsed.valid.length + parsed.invalidLines.length + parsed.duplicateLines.length,
    imported: inserted.size,
    alreadyStored: rows.length - inserted.size,
    duplicateLines: parsed.duplicateLines,
    invalidLines: parsed.invalidLines,
  };
  log("info", "codes_imported", {
    tenantId: params.tenantId,
    sku: variant.sku,
    imported: summary.imported,
    alreadyStored: summary.alreadyStored,
    invalid: summary.invalidLines.length,
  });
  return summary;
}

export type VariantInventory = {
  variant: KasperskyVariant;
  counts: Record<LicenceCodeStatus, number>;
  total: number;
};

export async function getKasperskyInventory(tenantId: string): Promise<VariantInventory[]> {
  const rows = await getLicenceInventoryCounts(tenantId);
  return KASPERSKY_VARIANTS.map((variant) => {
    const counts = Object.fromEntries(LICENCE_CODE_STATUSES.map((status) => [status, 0])) as Record<
      LicenceCodeStatus,
      number
    >;
    for (const row of rows) {
      if (row.productSku === variant.sku && row.status in counts) counts[row.status] += row.count;
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return { variant, counts, total };
  });
}

// ---------------------------------------------------------------------------
// Licence documents
// ---------------------------------------------------------------------------

export async function requestLicenceDocument(params: {
  tenantId: string;
  request: LicenceRequest;
  idempotencyKey: string;
  source: LicenceOrderSource;
  actor: string;
  createdById?: string | null;
  apiKeyId?: string | null;
  external?: { source: string; orderId: string; lineId: string } | null;
}): Promise<CreateLicenceOrderResult> {
  // Fail before reserving anything if codes could not be decrypted later.
  assertLicenceEncryptionConfigured();
  const { request } = params;
  const result = await createLicenceOrderWithAllocation({
    tenantId: params.tenantId,
    productSku: request.sku,
    quantity: request.quantity,
    source: params.source,
    idempotencyKey: params.idempotencyKey,
    requestHash: hashLicenceRequest(request, params.external),
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    orderReference: request.orderReference,
    activationRegion: request.activationRegion,
    useBefore: request.useBefore,
    notes: request.notes,
    externalSource: params.external?.source ?? null,
    externalOrderId: params.external?.orderId ?? null,
    externalLineId: params.external?.lineId ?? null,
    createdById: params.createdById ?? null,
    apiKeyId: params.apiKeyId ?? null,
    actor: params.actor,
  });
  log("info", "licence_order", {
    tenantId: params.tenantId,
    outcome: result.kind,
    orderId: result.order.id,
    sku: request.sku,
    quantity: request.quantity,
    source: params.source,
  });
  return result;
}

export async function getSellerBranding(tenantId: string): Promise<LicenceSellerBranding> {
  const settings = await prisma.companySettings.findUnique({
    where: { userId: tenantId },
    select: { companyName: true, email: true, phone: true },
  });
  return {
    name: settings?.companyName?.trim() || DEFAULT_SELLER_BRANDING.name,
    email: settings?.email?.trim() || DEFAULT_SELLER_BRANDING.email,
    phone: settings?.phone?.trim() || null,
    website: process.env.DIGITAL_LICENCE_SELLER_WEBSITE?.trim() || DEFAULT_SELLER_BRANDING.website,
  };
}

export function licencePdfFilename(order: Pick<LicenceOrderRecord, "number" | "productSku">) {
  const variant = getKasperskyVariant(order.productSku);
  const product = variant ? `${variant.tier}-${variant.devices}p` : "licence";
  return `licence-kaspersky-${product}-${order.number}.pdf`.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * Renders the PDF of an order. Decrypts only the codes allocated to that
 * order. On first success the codes switch to USED.
 */
export async function renderLicenceOrderPdf(params: {
  tenantId: string;
  orderId: string;
  actor: string;
}): Promise<{ order: LicenceOrderRecord; pdf: Buffer; filename: string }> {
  const order = await getLicenceOrder(params.tenantId, params.orderId);
  if (!order) throw new LicenceOrderStateError("Licence introuvable.");
  if (order.status === "CANCELLED") {
    throw new LicenceOrderStateError("Cette licence a été annulée.");
  }
  const variant = getKasperskyVariant(order.productSku);
  if (!variant) throw new LicenceOrderStateError("Produit inconnu pour cette licence.");

  const ciphers = await getOrderCodeCiphertexts(params.tenantId, order.id);
  if (ciphers.length !== order.quantity) {
    log("error", "allocation_mismatch", {
      orderId: order.id,
      expected: order.quantity,
      found: ciphers.length,
    });
    throw new LicenceOrderStateError("Les codes de cette licence sont incomplets.");
  }

  let pdf: Buffer;
  try {
    const codes = ciphers.map((row) =>
      decryptLicenceCode({ tenantId: params.tenantId, codeId: row.id, ciphertext: row.codeCiphertext }),
    );
    const html = buildKasperskyLicenceHtml({
      variant,
      codes,
      licenceNumber: order.number,
      orderReference: order.orderReference,
      customerName: order.customerName,
      activationRegion: order.activationRegion,
      useBefore: order.useBefore,
      seller: await getSellerBranding(params.tenantId),
    });
    pdf = await renderPdfFromHtml(html);
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : "UnknownError";
    log("error", "pdf_failed", { orderId: order.id, errorCode });
    await recordLicenceOrderFailure({
      tenantId: params.tenantId,
      orderId: order.id,
      errorCode,
      actor: params.actor,
    }).catch(() => undefined);
    throw error;
  }

  await markLicenceOrderGenerated({
    tenantId: params.tenantId,
    orderId: order.id,
    actor: params.actor,
    kind: order.generationCount === 0 ? "generated" : "downloaded",
  });
  const refreshed = (await getLicenceOrder(params.tenantId, order.id)) ?? order;
  return { order: refreshed, pdf, filename: licencePdfFilename(order) };
}
