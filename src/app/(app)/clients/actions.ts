"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  AccountMembershipRole,
  AccountPermission,
} from "@/lib/db/prisma";
import {
  clientSchema,
  createClient,
  deleteClient,
  getClientTenantId,
  revalidateClientDetail,
  revalidateClientFilters,
  revalidateClientList,
  updateClient,
} from "@/server/clients";
import {
  importClientsFromCsv,
  type ClientImportSummary,
} from "@/server/client-import";
import { revalidateQuoteFilterClients } from "@/server/quotes";
import { isRedirectError } from "@/lib/next";
import { requireUser } from "@/lib/auth";
import {
  createClientPayment,
  createClientService,
  deleteClientPayment,
  deleteClientService,
  revalidateClientPaymentData,
  revalidatePaymentServiceCatalog,
  updateClientService,
} from "@/server/client-payments";
import {
  createAccountInvitation,
} from "@/server/accounts";
import { getMessagingSettingsSummary } from "@/server/messaging";
import { getSettingsSummary } from "@/server/settings";
import { queueReceiptEmailJob } from "@/server/document-email-jobs";
import {
  requireAccountPermission,
} from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import type { Route } from "next";
import { toCents } from "@/lib/money";
import type {
  DocumentEmailActionInput,
  DocumentEmailActionResult,
} from "@/types/document-email";
import type { ClientDirectoryItem } from "@/lib/client-directory-cache";

type MutationVariant = "success" | "error";
const MAX_CLIENT_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export type ClientPaymentWorkspaceActionResult<T = undefined> = {
  status: "success" | "error";
  variant: MutationVariant;
  message: string;
  data?: T;
};

export type ClientFormActionState = {
  status?: "success" | "error";
  variant?: MutationVariant;
  message?: string;
  data?: {
    client: ClientDirectoryItem;
    redirectTo: string;
  };
};

export type ClientImportActionState = {
  submissionId?: string;
  status?: "success" | "error";
  variant?: MutationVariant;
  message?: string;
  summary?: ClientImportSummary;
};

export type SerializedPaymentServiceLink = {
  id: string;
  clientServiceId: string | null;
  titleSnapshot: string;
  detailsSnapshot: string | null;
  allocatedAmountCents: number | null;
  position: number;
};

export type SerializedClientPayment = {
  id: string;
  amountCents: number;
  currency: string;
  date: string;
  createdAt: string;
  method: string | null;
  reference: string | null;
  description: string | null;
  note: string | null;
  privateNote: string | null;
  receiptNumber: string | null;
  receiptIssuedAt: string | null;
  receiptSentAt: string | null;
  client: {
    id: string;
    displayName: string;
    companyName: string | null;
    email: string | null;
  };
  serviceLinks: SerializedPaymentServiceLink[];
};

export type SerializedPendingInvitation = {
  invitationId: string;
  email: string;
  role: AccountMembershipRole;
  permissions: AccountPermission[];
  invitedByName: string | null;
  invitedByEmail: string;
  expiresAt: string;
};

function parseClientForm(formData: FormData) {
  const payload = {
    displayName: formData.get("displayName")?.toString() ?? "",
    companyName: formData.get("companyName")?.toString() || null,
    address: formData.get("address")?.toString() || null,
    email: formData.get("email")?.toString() || null,
    phone: formData.get("phone")?.toString() || null,
    vatNumber: formData.get("vatNumber")?.toString() || null,
    notes: formData.get("notes")?.toString() || null,
    isActive:
      (formData.get("isActive")?.toString() ?? "true").toLowerCase() !==
      "false",
  } satisfies Record<string, unknown>;

  return clientSchema.parse(payload);
}

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
  options?: { clientListRefresh?: boolean },
): never {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  ["message", "error", "warning", "_clientsRefresh"].forEach((key) => {
    params.delete(key);
  });
  if (feedback.message) params.set("message", feedback.message);
  if (feedback.error) params.set("error", feedback.error);
  if (feedback.warning) params.set("warning", feedback.warning);
  if (options?.clientListRefresh && path === "/clients") {
    params.set("_clientsRefresh", Date.now().toString(36));
  }
  const nextQuery = params.toString();
  const href = (nextQuery ? `${path}?${nextQuery}` : path) as Route;
  return redirect(href);
}

function invalidateClientRelatedCaches(
  user: Awaited<ReturnType<typeof requireUser>>,
  options: {
    clientId?: string;
    includePaymentViews?: boolean;
  } = {},
) {
  const tenantId = getClientTenantId(user);
  revalidateClientList(tenantId);
  revalidateClientFilters(tenantId);
  revalidateQuoteFilterClients(tenantId);
  if (options.clientId) {
    revalidateClientDetail(tenantId, options.clientId);
  }
  if (options.includePaymentViews) {
    revalidateClientPaymentData(tenantId);
  }
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

function parseDateField(value: FormDataEntryValue | null, fallback = new Date()) {
  const normalized = value?.toString().trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("Date invalide");
  }
  return parsed;
}

function parseAmountField(value: FormDataEntryValue | null) {
  const normalized = value?.toString().trim().replace(",", ".") ?? "";
  if (!normalized) {
    throw new Error("Montant requis");
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide");
  }
  return amount;
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

function parseAccountRole(value: FormDataEntryValue | null) {
  const candidate = value?.toString();
  if (candidate === AccountMembershipRole.ADMIN) {
    return AccountMembershipRole.ADMIN;
  }
  return AccountMembershipRole.MEMBER;
}

function parseAccountPermissions(formData: FormData) {
  const allowed = new Set(Object.values(AccountPermission));
  const clientWorkspacePermissions: AccountPermission[] = [
    AccountPermission.CLIENTS_MANAGE,
    AccountPermission.SERVICES_MANAGE,
    AccountPermission.PAYMENTS_MANAGE,
    AccountPermission.RECEIPTS_MANAGE,
    AccountPermission.REPORTS_VIEW,
    AccountPermission.COLLABORATORS_MANAGE,
  ];
  const selected = formData
    .getAll("permissions")
    .map((entry) => entry.toString())
    .filter(
      (entry): entry is AccountPermission =>
        allowed.has(entry as AccountPermission),
    );
  const normalized = new Set(selected);

  if (
    selected.some((permission) =>
      clientWorkspacePermissions.includes(permission),
    )
  ) {
    normalized.add(AccountPermission.CLIENTS_VIEW);
  }

  return Array.from(normalized);
}

function serializeClientDirectoryItem(client: {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  isActive: boolean;
  updatedAt: Date;
}): ClientDirectoryItem {
  return {
    id: client.id,
    displayName: client.displayName,
    companyName: client.companyName ?? null,
    email: client.email ?? null,
    phone: client.phone ?? null,
    vatNumber: client.vatNumber ?? null,
    isActive: client.isActive,
    updatedAt: client.updatedAt.toISOString(),
  };
}

function serializeClientPaymentRecord(payment: Awaited<ReturnType<typeof createClientPayment>>): SerializedClientPayment {
  const serializeDate = (value: Date | null | undefined) =>
    value instanceof Date ? value.toISOString() : new Date().toISOString();

  return {
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    date: serializeDate(payment.date),
    createdAt: serializeDate(payment.createdAt),
    method: payment.method ?? null,
    reference: payment.reference ?? null,
    description: payment.description ?? null,
    note: payment.note ?? null,
    privateNote: payment.privateNote ?? null,
    receiptNumber: payment.receiptNumber ?? null,
    receiptIssuedAt: payment.receiptIssuedAt instanceof Date
      ? payment.receiptIssuedAt.toISOString()
      : null,
    receiptSentAt: payment.receiptSentAt instanceof Date
      ? payment.receiptSentAt.toISOString()
      : null,
    client: {
      id: payment.client.id,
      displayName: payment.client.displayName,
      companyName: payment.client.companyName ?? null,
      email: payment.client.email ?? null,
    },
    serviceLinks: payment.serviceLinks.map((link) => ({
      id: link.id,
      clientServiceId: link.clientServiceId ?? null,
      titleSnapshot: link.titleSnapshot,
      detailsSnapshot: link.detailsSnapshot ?? null,
      allocatedAmountCents: link.allocatedAmountCents ?? null,
      position: link.position,
    })),
  };
}

function serializePendingInvitationResult(
  invitation: Awaited<ReturnType<typeof createAccountInvitation>>,
  user: Awaited<ReturnType<typeof requireUser>>,
): SerializedPendingInvitation {
  return {
    invitationId: invitation.invitationId,
    email: invitation.email,
    role: invitation.role,
    permissions: invitation.permissions,
    invitedByName: user.name?.trim() ?? null,
    invitedByEmail: user.email,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

function getClientFormErrorMessage(error: unknown) {
  if (error instanceof AuthorizationError) {
    return error.message;
  }
  if (error instanceof ZodError) {
    return "Informations client invalides.";
  }
  return "Impossible de créer ou mettre à jour le client.";
}

function getMutationErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof AuthorizationError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function buildClientImportSuccessMessage(summary: ClientImportSummary) {
  const parts = [];

  if (summary.createdCount > 0) {
    parts.push(`${summary.createdCount} cree(s)`);
  }
  if (summary.updatedCount > 0) {
    parts.push(`${summary.updatedCount} mis a jour`);
  }

  if (parts.length === 0) {
    return "Import termine";
  }

  return `Import termine: ${parts.join(", ")}`;
}

async function performCreateClient(formData: FormData) {
  const user = await requireAccountPermission(AccountPermission.CLIENTS_MANAGE);
  const data = parseClientForm(formData);
  const client = await createClient(data, getClientTenantId(user));
  invalidateClientRelatedCaches(user, {
    clientId: client.id,
  });
  return {
    message: "Client créé",
    client: serializeClientDirectoryItem(client),
  };
}

async function performUpdateClient(id: string, formData: FormData) {
  const user = await requireAccountPermission(AccountPermission.CLIENTS_MANAGE);
  const data = parseClientForm(formData);
  const client = await updateClient(id, data, getClientTenantId(user));
  invalidateClientRelatedCaches(user, {
    clientId: id,
    includePaymentViews: true,
  });
  return {
    message: "Client mis à jour",
    client: serializeClientDirectoryItem(client),
  };
}

async function performDeleteClient(id: string) {
  const user = await requireAccountPermission(AccountPermission.CLIENTS_MANAGE);
  await deleteClient(id, getClientTenantId(user));
  invalidateClientRelatedCaches(user, {
    clientId: id,
  });
  return {
    message: "Client supprimé",
  };
}

async function performImportClients(formData: FormData) {
  const user = await requireAccountPermission(AccountPermission.CLIENTS_MANAGE);
  const tenantId = getClientTenantId(user);
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Fichier CSV manquant.");
  }

  if (file.size <= 0) {
    throw new Error("Le fichier CSV est vide.");
  }

  if (file.size > MAX_CLIENT_IMPORT_FILE_BYTES) {
    throw new Error("Le fichier CSV depasse la taille maximale autorisee.");
  }

  const content = await file.text();
  const summary = await importClientsFromCsv(content, tenantId);

  if (summary.createdCount + summary.updatedCount === 0) {
    return {
      submissionId: Date.now().toString(36),
      status: "error" as const,
      variant: "error" as const,
      message: "Aucun client importable n'a ete trouve.",
      summary,
    };
  }

  invalidateClientRelatedCaches(user, {
    includePaymentViews: true,
  });

  return {
    submissionId: Date.now().toString(36),
    status: "success" as const,
    variant: "success" as const,
    message: buildClientImportSuccessMessage(summary),
    summary,
  };
}

async function performCreateClientPayment(formData: FormData) {
  const clientId = normalizeOptionalString(formData.get("clientId"));
  const user = await requireAccountPermission(AccountPermission.PAYMENTS_MANAGE);
  const tenantId = getClientTenantId(user);

  if (!clientId) {
    throw new Error("Client requis");
  }

  const serviceIds = formData
    .getAll("clientServiceIds")
    .map((entry) => entry.toString().trim())
    .filter((entry) => entry.length > 0);

  const payment = await createClientPayment(
    {
      clientId,
      amount: parseAmountField(formData.get("amount")),
      currency: normalizeRequiredString(formData.get("currency"), "TND"),
      date: parseDateField(formData.get("date")),
      method: normalizeOptionalString(formData.get("method")),
      reference: normalizeOptionalString(formData.get("reference")),
      description: normalizeOptionalString(formData.get("description")),
      note: normalizeOptionalString(formData.get("note")),
      privateNote: normalizeOptionalString(formData.get("privateNote")),
      serviceLinks: serviceIds.map((serviceId, index) => ({
        clientServiceId: serviceId,
        position: index,
      })),
    },
    tenantId,
  );
  revalidateClientPaymentData(tenantId, {
    paymentId: payment.id,
  });

  return {
    message: "Paiement client enregistré",
    payment,
    clientId,
  };
}

async function performDeleteClientPayment(paymentId: string) {
  const user = await requireAccountPermission(AccountPermission.PAYMENTS_MANAGE);
  const tenantId = getClientTenantId(user);
  await deleteClientPayment(paymentId, tenantId);
  revalidateClientPaymentData(tenantId, {
    paymentId,
  });
  return {
    message: "Paiement client supprimé",
  };
}

async function performCreateClientPaymentsInvitation(formData: FormData) {
  const user = await requireAccountPermission(
    AccountPermission.COLLABORATORS_MANAGE,
  );
  const role = parseAccountRole(formData.get("role"));
  const permissions = parseAccountPermissions(formData);

  if (role === AccountMembershipRole.MEMBER && permissions.length === 0) {
    throw new Error(
      "Sélectionnez au moins une permission pour ce collaborateur.",
    );
  }

  const invitation = await createAccountInvitation({
    accountId: getClientTenantId(user),
    invitedByUserId: user.id,
    email: normalizeRequiredString(formData.get("email")),
    role,
    permissions,
  });
  revalidatePath("/collaborateurs");

  return {
    message: "Invitation collaborateur envoyée",
    invitation: serializePendingInvitationResult(invitation, user),
  };
}

export async function createClientFormAction(
  _previousState: ClientFormActionState,
  formData: FormData,
): Promise<ClientFormActionState> {
  const redirectTarget = resolveRedirectTarget(formData, "/clients");

  try {
    const result = await performCreateClient(formData);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        client: result.client,
        redirectTo: redirectTarget,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createClientFormAction] Échec de création de client", error);
    return {
      status: "error",
      variant: "error",
      message: getClientFormErrorMessage(error),
    };
  }
}

export async function updateClientFormAction(
  id: string,
  _previousState: ClientFormActionState,
  formData: FormData,
): Promise<ClientFormActionState> {
  const redirectTarget = resolveRedirectTarget(formData, `/clients/${id}`);

  try {
    const result = await performUpdateClient(id, formData);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        client: result.client,
        redirectTo: redirectTarget,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateClientFormAction] Échec de mise à jour de client", error);
    return {
      status: "error",
      variant: "error",
      message: getClientFormErrorMessage(error),
    };
  }
}

export async function deleteClientInlineAction(
  id: string,
): Promise<ClientPaymentWorkspaceActionResult<{ clientId: string }>> {
  try {
    const result = await performDeleteClient(id);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        clientId: id,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteClientInlineAction] Échec de suppression", error);
    return {
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Impossible de supprimer ce client.",
      ),
    };
  }
}

export async function importClientsInlineAction(
  _previousState: ClientImportActionState,
  formData: FormData,
): Promise<ClientImportActionState> {
  try {
    return await performImportClients(formData);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[importClientsInlineAction] Échec d'import CSV", error);
    return {
      submissionId: Date.now().toString(36),
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Import impossible. Verifiez votre fichier CSV.",
      ),
    };
  }
}

export async function createClientPaymentInlineAction(
  formData: FormData,
): Promise<ClientPaymentWorkspaceActionResult<{ payment: SerializedClientPayment }>> {
  try {
    const result = await performCreateClientPayment(formData);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        payment: serializeClientPaymentRecord(result.payment),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createClientPaymentInlineAction] Échec de création", error);
    return {
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Impossible d'enregistrer ce paiement.",
      ),
    };
  }
}

export async function deleteClientPaymentInlineAction(
  paymentId: string,
): Promise<ClientPaymentWorkspaceActionResult<{ paymentId: string }>> {
  try {
    const result = await performDeleteClientPayment(paymentId);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        paymentId,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteClientPaymentInlineAction] Échec de suppression", error);
    return {
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Impossible de supprimer ce paiement.",
      ),
    };
  }
}

export async function createClientPaymentsInvitationInlineAction(
  formData: FormData,
): Promise<
  ClientPaymentWorkspaceActionResult<{
    invitation: SerializedPendingInvitation;
  }>
> {
  try {
    const result = await performCreateClientPaymentsInvitation(formData);
    return {
      status: "success",
      variant: "success",
      message: result.message,
      data: {
        invitation: result.invitation,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error(
      "[createClientPaymentsInvitationInlineAction] Échec d'invitation",
      error,
    );
    return {
      status: "error",
      variant: "error",
      message: getMutationErrorMessage(
        error,
        "Impossible d'envoyer l'invitation.",
      ),
    };
  }
}

export async function createClientAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/clients");
  try {
    const result = await performCreateClient(formData);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    }, {
      clientListRefresh: true,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createClientAction] Échec de création de client", error);
    const message =
      error instanceof AuthorizationError
        ? error.message
        : error instanceof ZodError
          ? "Informations client invalides."
          : "Impossible de créer le client.";
    redirectWithFeedback(redirectTarget, {
      error: message,
    }, {
      clientListRefresh: true,
    });
  }
}

export async function updateClientAction(id: string, formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/clients");
  try {
    const result = await performUpdateClient(id, formData);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    }, {
      clientListRefresh: true,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateClientAction] Échec de mise à jour de client", error);
    const message =
      error instanceof AuthorizationError
        ? error.message
        : error instanceof ZodError
          ? "Informations client invalides."
          : "Impossible de mettre à jour le client.";
    redirectWithFeedback(redirectTarget, {
      error: message,
    }, {
      clientListRefresh: true,
    });
  }
}

export async function deleteClientAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/clients");
  try {
    const result = await performDeleteClient(id);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    }, {
      clientListRefresh: true,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteClientAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : "Impossible de supprimer ce client.",
    }, {
      clientListRefresh: true,
    });
  }
}

export async function createClientServiceAction(
  clientId: string,
  formData: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/services?client=${clientId}`,
  );
  const user = await requireAccountPermission(AccountPermission.SERVICES_MANAGE);
  const tenantId = getClientTenantId(user);
  try {
    const settings = await getSettingsSummary(tenantId);
    await createClientService(
      {
        clientId,
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
    redirectWithFeedback(redirectTarget, {
      message: "Service client ajouté",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createClientServiceAction] Échec de création", error);
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

export async function updateClientServiceAction(
  serviceId: string,
  clientId: string,
  formData: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/services?client=${clientId}`,
  );
  const user = await requireAccountPermission(AccountPermission.SERVICES_MANAGE);
  const tenantId = getClientTenantId(user);
  try {
    const settings = await getSettingsSummary(tenantId);
    await updateClientService(
      serviceId,
      {
        clientId,
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
    redirectWithFeedback(redirectTarget, {
      message: "Service client mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateClientServiceAction] Échec de mise à jour", error);
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

export async function deleteClientServiceAction(
  serviceId: string,
  clientId: string,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/services?client=${clientId}`,
  );
  const user = await requireAccountPermission(AccountPermission.SERVICES_MANAGE);
  try {
    const tenantId = getClientTenantId(user);
    await deleteClientService(serviceId, tenantId);
    revalidatePaymentServiceCatalog(tenantId);
    redirectWithFeedback(redirectTarget, {
      message: "Service client supprimé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteClientServiceAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : "Impossible de supprimer ce service.",
    });
  }
}

export async function createClientPaymentAction(formData: FormData) {
  const clientId = normalizeOptionalString(formData.get("clientId"));
  const redirectTarget = resolveRedirectTarget(
    formData,
    clientId ? `/paiements?client=${clientId}` : "/paiements",
  );
  try {
    const result = await performCreateClientPayment(formData);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createClientPaymentAction] Échec de création", error);
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Impossible d'enregistrer ce paiement.",
    });
  }
}

export async function deleteClientPaymentAction(
  paymentId: string,
  clientId: string,
  formData?: FormData,
) {
  const redirectTarget = resolveRedirectTarget(
    formData,
    `/paiements?client=${clientId}`,
  );
  try {
    const result = await performDeleteClientPayment(paymentId);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteClientPaymentAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : "Impossible de supprimer ce paiement.",
    });
  }
}

export async function sendClientPaymentReceiptEmailAction(
  paymentId: string,
  input: DocumentEmailActionInput,
): Promise<DocumentEmailActionResult> {
  const user = await requireAccountPermission(AccountPermission.RECEIPTS_MANAGE);
  const tenantId = getClientTenantId(user);
  const messagingSummary = await getMessagingSettingsSummary(tenantId);
  const email = input.email?.trim() ?? "";
  const subject = input.subject?.trim();

  if (!messagingSummary.smtpConfigured) {
    return {
      status: "config-missing",
      variant: "warning",
      message:
        "Veuillez configurer la messagerie (SMTP/IMAP) avant d'envoyer des reçus.",
    };
  }

  if (!email) {
    return {
      status: "invalid",
      variant: "error",
      message: "Adresse e-mail requise.",
    };
  }

  try {
    const queueResult = await queueReceiptEmailJob({
      userId: tenantId,
      paymentId,
      to: email,
      subject,
    });
    if (queueResult.deduped) {
      return {
        status: "duplicate",
        variant: "warning",
        message: "Un envoi est déjà en cours pour ce reçu.",
        jobId: queueResult.jobId,
        deduped: true,
      };
    }
    return {
      status: "queued",
      variant: "success",
      message: "Reçu en cours d'envoi en arrière-plan.",
      jobId: queueResult.jobId,
      deduped: false,
    };
  } catch (error) {
    console.error(
      "[sendClientPaymentReceiptEmailAction] Échec de mise en file",
      error,
    );
    return {
      status: "error",
      variant: "error",
      message:
        "Impossible de planifier cet envoi. Veuillez réessayer dans un instant.",
    };
  }
}

export async function createClientPaymentsInvitationAction(
  formData: FormData,
) {
  const redirectTarget = resolveRedirectTarget(formData, "/collaborateurs");
  try {
    const result = await performCreateClientPaymentsInvitation(formData);
    redirectWithFeedback(redirectTarget, {
      message: result.message,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error(
      "[createClientPaymentsInvitationAction] Échec d'invitation",
      error,
    );
    redirectWithFeedback(redirectTarget, {
      error:
        error instanceof AuthorizationError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Impossible d'envoyer l'invitation.",
    });
  }
}
