"use server";

import { redirect } from "next/navigation";
import { AccountPermission } from "@/lib/db/prisma";
import { getClientTenantId } from "@/server/clients";
import {
  createPaymentService,
  deletePaymentService,
  revalidatePaymentServiceCatalog,
  updatePaymentService,
} from "@/server/client-payments";
import { getSettings } from "@/server/settings";
import { requireAccountPermission } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { isRedirectError } from "@/lib/next";
import { toCents } from "@/lib/money";
import type { Route } from "next";

type MutationVariant = "success" | "error";

export type SerializedPaymentService = {
  id: string;
  title: string;
  details: string | null;
  priceCents: number;
  notes: string | null;
  privateNotes: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type PaymentServiceMutationResult<T = undefined> = {
  status: "success" | "error";
  variant: MutationVariant;
  message: string;
  data?: T;
};

function resolveRedirectTarget(
  formData: FormData | undefined,
  fallback: string,
) {
  const redirectTo = formData?.get("redirectTo")?.toString();
  if (redirectTo && redirectTo.startsWith("/")) {
    return redirectTo;
  }
  return fallback;
}

function redirectWithFeedback(
  target: string,
  feedback: { message?: string; error?: string; warning?: string },
): never {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  ["message", "error", "warning"].forEach((key) => {
    params.delete(key);
  });
  if (feedback.message) params.set("message", feedback.message);
  if (feedback.error) params.set("error", feedback.error);
  if (feedback.warning) params.set("warning", feedback.warning);
  const nextQuery = params.toString();
  const href = (nextQuery ? `${path}?${nextQuery}` : path) as Route;
  return redirect(href);
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim() ?? "";
  return normalized.length ? normalized : null;
}

function normalizeRequiredString(
  value: FormDataEntryValue | null,
  fallback = "",
) {
  return value?.toString().trim() ?? fallback;
}

function parseBooleanField(value: FormDataEntryValue | null, fallback = true) {
  const normalized = value?.toString().trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return normalized !== "false";
}

function parseNonNegativeAmountField(
  value: FormDataEntryValue | null,
  fieldName = "Montant",
) {
  const normalized = value?.toString().trim().replace(",", ".") ?? "";
  if (!normalized) {
    throw new Error(`${fieldName} requis`);
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${fieldName} invalide`);
  }
  return amount;
}

function serializePaymentService(service: Awaited<ReturnType<typeof createPaymentService>>): SerializedPaymentService {
  return {
    id: service.id,
    title: service.title,
    details: service.details ?? null,
    priceCents: service.priceCents,
    notes: service.notes ?? null,
    privateNotes: service.privateNotes ?? null,
    isActive: service.isActive,
    updatedAt: service.updatedAt.toISOString(),
  };
}

function getMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AuthorizationError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

async function performCreatePaymentService(formData: FormData) {
  const user = await requireAccountPermission(AccountPermission.SERVICES_MANAGE);
  const tenantId = getClientTenantId(user);
  const settings = await getSettings(tenantId);
  const service = await createPaymentService(
    {
      title: normalizeRequiredString(formData.get("title")),
      details: normalizeOptionalString(formData.get("details")),
      priceCents: toCents(
        parseNonNegativeAmountField(formData.get("price"), "Prix"),
        settings.defaultCurrency,
      ),
      notes: normalizeOptionalString(formData.get("notes")),
      privateNotes: normalizeOptionalString(formData.get("privateNotes")),
      isActive: parseBooleanField(formData.get("isActive"), true),
    },
    tenantId,
  );
  revalidatePaymentServiceCatalog(tenantId);
  return {
    message: "Service ajouté au catalogue",
    service: serializePaymentService(service),
  };
}

async function performUpdatePaymentService(serviceId: string, formData: FormData) {
  const user = await requireAccountPermission(AccountPermission.SERVICES_MANAGE);
  const tenantId = getClientTenantId(user);
  const settings = await getSettings(tenantId);
  const service = await updatePaymentService(
    serviceId,
    {
      title: normalizeRequiredString(formData.get("title")),
      details: normalizeOptionalString(formData.get("details")),
      priceCents: toCents(
        parseNonNegativeAmountField(formData.get("price"), "Prix"),
        settings.defaultCurrency,
      ),
      notes: normalizeOptionalString(formData.get("notes")),
      privateNotes: normalizeOptionalString(formData.get("privateNotes")),
      isActive: parseBooleanField(formData.get("isActive"), true),
    },
    tenantId,
  );
  revalidatePaymentServiceCatalog(tenantId);
  return {
    message: "Service mis à jour",
    service: serializePaymentService(service),
  };
}

async function performDeletePaymentService(serviceId: string) {
  const user = await requireAccountPermission(AccountPermission.SERVICES_MANAGE);
  const tenantId = getClientTenantId(user);
  await deletePaymentService(serviceId, tenantId);
  revalidatePaymentServiceCatalog(tenantId);
  return {
    message: "Service supprimé du catalogue",
  };
}

export async function createPaymentServiceInlineAction(
  formData: FormData,
): Promise<
  PaymentServiceMutationResult<{ service: SerializedPaymentService }>
> {
  try {
    const result = await performCreatePaymentService(formData);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        service: result.service,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createPaymentServiceInlineAction] Échec de création", error);
    return {
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Impossible d'ajouter ce service.",
      ),
    };
  }
}

export async function updatePaymentServiceInlineAction(
  serviceId: string,
  formData: FormData,
): Promise<
  PaymentServiceMutationResult<{ service: SerializedPaymentService }>
> {
  try {
    const result = await performUpdatePaymentService(serviceId, formData);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        service: result.service,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updatePaymentServiceInlineAction] Échec de mise à jour", error);
    return {
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Impossible de mettre à jour ce service.",
      ),
    };
  }
}

export async function deletePaymentServiceInlineAction(
  serviceId: string,
): Promise<PaymentServiceMutationResult<{ serviceId: string }>> {
  try {
    const result = await performDeletePaymentService(serviceId);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        serviceId,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deletePaymentServiceInlineAction] Échec de suppression", error);
    return {
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Impossible de supprimer ce service.",
      ),
    };
  }
}

export async function createPaymentServiceAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/services");

  try {
    const result = await performCreatePaymentService(formData);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createPaymentServiceAction] Échec de création", error);
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Impossible d'ajouter ce service.",
    });
  }
}

export async function updatePaymentServiceAction(
  serviceId: string,
  formData: FormData,
) {
  const redirectTarget = resolveRedirectTarget(formData, "/services");

  try {
    const result = await performUpdatePaymentService(serviceId, formData);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updatePaymentServiceAction] Échec de mise à jour", error);
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Impossible de mettre à jour ce service.",
    });
  }
}

export async function deletePaymentServiceAction(
  serviceId: string,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(formData, "/services");

  try {
    const result = await performDeletePaymentService(serviceId);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deletePaymentServiceAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : "Impossible de supprimer ce service.",
    });
  }
}
