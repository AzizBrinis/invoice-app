"use server";

import { randomUUID } from "node:crypto";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppSectionAccess } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { isRedirectError } from "@/lib/next";
import { LicenceImportTooLargeError } from "@/lib/digital-products/licence-code-format";
import {
  importLicenceCodes,
  LicenceValidationError,
  parseLicenceRequest,
  requestLicenceDocument,
  type LicenceImportSummary,
} from "@/server/digital-products/licences";
import { LicenceEncryptionConfigError } from "@/server/digital-products/licence-crypto";
import {
  cancelPendingLicenceOrder,
  InsufficientLicenceStockError,
  revokeLicenceCode,
} from "@/server/digital-products/store";

const BASE_PATH = "/produits-digitaux";
const KASPERSKY_PATH = `${BASE_PATH}/kaspersky`;

export type ImportCodesActionState = {
  submissionId?: string;
  status?: "success" | "error";
  message?: string;
  summary?: LicenceImportSummary;
};

export type GenerateLicenceActionState = {
  status?: "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

async function requireAdmin() {
  const user = await requireAppSectionAccess("digitalProducts");
  return { user, tenantId: user.activeTenantId ?? user.tenantId ?? user.id };
}

function revalidateDigitalProducts() {
  revalidatePath(BASE_PATH, "layout");
}

function knownErrorMessage(error: unknown): string | null {
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof LicenceValidationError) return error.message;
  if (error instanceof LicenceEncryptionConfigError) return error.message;
  if (error instanceof LicenceImportTooLargeError) return error.message;
  if (error instanceof InsufficientLicenceStockError) {
    return `Stock insuffisant : ${error.available} code(s) disponible(s) pour ${error.requested} demandé(s).`;
  }
  return null;
}

const MAX_IMPORT_TEXT_BYTES = 512 * 1024;

export async function importCodesAction(
  _previous: ImportCodesActionState,
  formData: FormData,
): Promise<ImportCodesActionState> {
  const submissionId = randomUUID();
  try {
    const { user, tenantId } = await requireAdmin();
    const sku = String(formData.get("sku") ?? "");
    const text = String(formData.get("codes") ?? "");
    const batchLabel = String(formData.get("batchLabel") ?? "");
    if (!text.trim()) {
      return { submissionId, status: "error", message: "Saisissez au moins un code." };
    }
    if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_TEXT_BYTES) {
      return { submissionId, status: "error", message: "Contenu trop volumineux (512 Ko maximum)." };
    }
    const summary = await importLicenceCodes({
      tenantId,
      actorUserId: user.id,
      sku,
      text,
      batchLabel,
    });
    revalidateDigitalProducts();
    const problems = summary.alreadyStored + summary.invalidLines.length + summary.duplicateLines.length;
    return {
      submissionId,
      status: summary.imported > 0 ? "success" : "error",
      message:
        summary.imported > 0
          ? `${summary.imported} code(s) ajouté(s) au stock${problems ? `, ${problems} ignoré(s)` : ""}.`
          : "Aucun code ajouté.",
      summary,
    };
  } catch (error) {
    const message = knownErrorMessage(error);
    if (!message) console.error("[digital-licences] import_failed", { error: (error as Error)?.name });
    return { submissionId, status: "error", message: message ?? "Import impossible. Réessayez." };
  }
}

export async function generateLicenceAction(
  _previous: GenerateLicenceActionState,
  formData: FormData,
): Promise<GenerateLicenceActionState> {
  let orderId: string;
  try {
    const { user, tenantId } = await requireAdmin();
    const formToken = String(formData.get("formToken") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(formToken)) {
      return { status: "error", message: "Formulaire expiré. Rechargez la page." };
    }
    let request;
    try {
      request = parseLicenceRequest({
        sku: formData.get("sku"),
        quantity: formData.get("quantity"),
        customerName: formData.get("customerName") || null,
        customerEmail: formData.get("customerEmail") || null,
        orderReference: formData.get("orderReference") || null,
        activationRegion: formData.get("activationRegion") || null,
        useBefore: formData.get("useBefore") || null,
        notes: formData.get("notes") || null,
      });
    } catch (error) {
      if (error instanceof LicenceValidationError) {
        return {
          status: "error",
          message: error.message,
          fieldErrors: Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message])),
        };
      }
      throw error;
    }
    const result = await requestLicenceDocument({
      tenantId,
      request,
      // One token per rendered form: a double submit replays the same licence.
      idempotencyKey: `manual:${formToken}`,
      source: "MANUAL",
      actor: `user:${user.id}`,
      createdById: user.id,
    });
    if (result.kind === "idempotency_key_reused" || result.kind === "external_line_conflict") {
      return { status: "error", message: "Ce formulaire a déjà été utilisé. Rechargez la page." };
    }
    orderId = result.order.id;
    revalidateDigitalProducts();
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = knownErrorMessage(error);
    if (!message) console.error("[digital-licences] generate_failed", { error: (error as Error)?.name });
    return { status: "error", message: message ?? "Génération impossible. Réessayez." };
  }
  redirect(`${KASPERSKY_PATH}/licences/${orderId}?nouveau=1` as Route);
}

/**
 * Only same-origin paths inside the Kaspersky section. The check runs on the
 * URL as the browser will resolve it: dot segments and backslashes are
 * normalized first, so "/produits-digitaux/kaspersky/../..//evil.com" (which
 * resolves to "//evil.com") is rejected.
 */
function backTo(formData: FormData, fallback: string) {
  const raw = String(formData.get("redirectTo") ?? "");
  if (!raw.startsWith("/")) return fallback;
  let resolved: URL;
  try {
    resolved = new URL(raw, "http://local");
  } catch {
    return fallback;
  }
  const path = resolved.pathname;
  const inSection = path === KASPERSKY_PATH || path.startsWith(`${KASPERSKY_PATH}/`);
  if (resolved.origin !== "http://local" || path.startsWith("//") || !inSection) return fallback;
  return `${path}${resolved.search}`;
}

function withParam(path: string, key: string, value: string) {
  const url = new URL(path, "http://local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}` as Route;
}

export async function revokeCodeAction(formData: FormData) {
  const target = backTo(formData, `${KASPERSKY_PATH}/codes`);
  let outcome: [string, string];
  try {
    const { user, tenantId } = await requireAdmin();
    const codeId = String(formData.get("codeId") ?? "");
    const revoked = await revokeLicenceCode({ tenantId, codeId, actor: `user:${user.id}` });
    revalidateDigitalProducts();
    outcome = revoked
      ? ["message", "Code retiré du stock."]
      : ["error", "Seul un code disponible peut être retiré."];
  } catch (error) {
    outcome = ["error", knownErrorMessage(error) ?? "Action impossible."];
  }
  redirect(withParam(target, outcome[0], outcome[1]));
}

export async function cancelLicenceAction(formData: FormData) {
  const rawOrderId = String(formData.get("orderId") ?? "");
  const orderId = /^dlord-[0-9a-f-]{36}$/.test(rawOrderId) ? rawOrderId : "";
  if (!orderId) redirect(`${KASPERSKY_PATH}/licences` as Route);
  const target = `${KASPERSKY_PATH}/licences/${orderId}`;
  let outcome: [string, string];
  try {
    const { user, tenantId } = await requireAdmin();
    const result = await cancelPendingLicenceOrder({ tenantId, orderId, actor: `user:${user.id}` });
    revalidateDigitalProducts();
    outcome = result
      ? ["message", `Licence annulée : ${result.released} code(s) remis en stock.`]
      : ["error", "Seule une licence dont le PDF n’a jamais été généré peut être annulée."];
  } catch (error) {
    outcome = ["error", knownErrorMessage(error) ?? "Action impossible."];
  }
  redirect(withParam(target, outcome[0], outcome[1]));
}
