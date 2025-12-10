import { z, type ZodTypeAny } from "zod";
import {
  ClientSource,
  InvoiceStatus,
  Prisma,
  QuoteStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/formatters";
import { fromCents, toCents } from "@/lib/money";
import { getDefaultCurrencyCode } from "@/lib/currency";
import {
  createClient,
  updateClient,
} from "@/server/clients";
import {
  createProduct,
  updateProduct,
} from "@/server/products";
import {
  createQuote,
  updateQuote,
  duplicateQuote,
  convertQuoteToInvoice,
  type QuoteInput,
} from "@/server/quotes";
import {
  createInvoice,
  updateInvoice,
  duplicateInvoice,
  type InvoiceInput,
} from "@/server/invoices";
import {
  fetchMessageDetail,
  fetchRecentMailboxEmails,
  getMailboxDisplayName,
  getMessagingSettingsSummary,
  sendEmailMessageForUser,
  type Mailbox,
} from "@/server/messaging";
import {
  queueInvoiceEmailJob,
  queueQuoteEmailJob,
} from "@/server/document-email-jobs";
import {
  searchClientsForAssistant,
  searchProductsForAssistant,
  normalizeSearchText,
} from "@/server/assistant/search";
import type { AssistantActionCard } from "@/types/assistant";
import type {
  AssistantToolDefinition,
  AssistantToolResult,
} from "@/server/assistant/types";
import { logAiAudit } from "@/server/assistant/audit";
import {
  listScheduledEmails,
  scheduleEmailDraft,
} from "@/server/messaging-scheduled";
import {
  formatScheduledTime,
  parseRequestedSendTime,
} from "@/server/assistant/email-scheduling";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

const defineTool = <TSchema extends ZodTypeAny>(
  definition: AssistantToolDefinition<TSchema>,
) => definition;

const stringField = (label: string) =>
  z
    .string()
    .min(1, `${label} requis`)
    .trim();

const baseEmail = z
  .string()
  .email("E-mail invalide")
  .max(120);

const optionalEmail = baseEmail.optional();

const optionalPhone = z
  .string()
  .min(6)
  .max(60)
  .optional();

const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  TND: 1,
  EUR: 3.3,
  USD: 3.1,
  GBP: 4.1,
  CAD: 2.3,
};

const customRates = (() => {
  try {
    return process.env.AI_CURRENCY_RATES
      ? (JSON.parse(process.env.AI_CURRENCY_RATES) as Record<string, number>)
      : {};
  } catch {
    return {};
  }
})();

const exchangeRates = { ...DEFAULT_EXCHANGE_RATES, ...customRates };

function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
) {
  const fromRate = exchangeRates[fromCurrency.toUpperCase()] ?? null;
  const toRate = exchangeRates[toCurrency.toUpperCase()] ?? null;
  if (!fromRate || !toRate) {
    throw new Error("Conversion indisponible pour cette devise.");
  }
  const base = amount / fromRate;
  return base * toRate;
}

const productLineSchema = z.object({
  productId: z.string().optional(),
  description: z
    .string()
    .min(2)
    .max(400),
  quantity: z.number().positive(),
  unit: stringField("Unité"),
  unitPrice: z.number().nonnegative(),
  vatRate: z.number().min(0).max(100),
  discountRate: z.number().min(0).max(90).optional(),
});

function formatActionCardAmount(amountCents: number, currency: string) {
  try {
    return formatCurrency(fromCents(amountCents, currency), currency);
  } catch {
    return `${fromCents(amountCents, currency)} ${currency}`;
  }
}

function buildDocumentCard(params: {
  type: "quote" | "invoice";
  title: string;
  number?: string | null;
  totalCents?: number | null;
  currency: string;
  href: string;
}): AssistantActionCard {
  return {
    type: params.type === "quote" ? "quote" : "invoice",
    title: params.title,
    subtitle: params.number ?? undefined,
    amount:
      typeof params.totalCents === "number"
        ? formatActionCardAmount(params.totalCents, params.currency)
        : undefined,
    href: params.href,
    actions: [
      {
        label: "Ouvrir",
        href: params.href,
      },
    ],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function convertPlainTextToHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function summarizeEmailBody(value: string, maxLength = 200): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

function mapMessagingSendError(error: unknown): string {
  if (error instanceof Error) {
    if (/auth|login failed|invalid credentials/i.test(error.message)) {
      return "Échec d'authentification SMTP.";
    }
    return error.message || "Échec de l'envoi du message.";
  }
  return "Échec de l'envoi du message.";
}

const MAILBOX_VALUES = ["inbox", "sent", "drafts", "trash", "spam"] as const;
const mailboxEnum = z.enum(MAILBOX_VALUES);

const MAILBOX_ALIAS_VALUES: Record<Mailbox, string[]> = {
  inbox: [
    "inbox",
    "reception",
    "reçu",
    "recus",
    "recusrecents",
    "boite de reception",
    "boite",
    "boite mail",
    "boite principale",
    "reception principale",
    "reçus",
    "boite de réception",
    "received",
    "incoming",
    "boitereception",
  ],
  sent: [
    "sent",
    "envoye",
    "envoyes",
    "envoyés",
    "envoyee",
    "envoyees",
    "messages envoyes",
    "messages envoyés",
    "outbox",
    "expedie",
    "expedies",
    "expédié",
    "expédiés",
    "courrier envoye",
    "envoyes recents",
  ],
  drafts: [
    "drafts",
    "draft",
    "brouillon",
    "brouillons",
    "non envoye",
    "non envoyes",
    "non envoyés",
    "en redaction",
  ],
  trash: [
    "trash",
    "corbeille",
    "corbeilles",
    "supprime",
    "supprimes",
    "supprimé",
    "supprimés",
    "deleted",
    "deleted items",
    "deleted messages",
    "archive",
    "archives",
    "poubelle",
    "bin",
  ],
  spam: [
    "spam",
    "indesirable",
    "indesirables",
    "indésirable",
    "indésirables",
    "junk",
    "junk mail",
    "pourriel",
    "courrier indesirable",
  ],
};

function normalizeMailboxInputValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const mailboxAliasLookup = new Map<string, Mailbox>();
for (const [mailbox, aliases] of Object.entries(
  MAILBOX_ALIAS_VALUES,
) as Array<[Mailbox, string[]]>) {
  for (const alias of aliases) {
    const normalized = normalizeMailboxInputValue(alias);
    if (normalized && !mailboxAliasLookup.has(normalized)) {
      mailboxAliasLookup.set(normalized, mailbox);
    }
  }
}

function resolveMailboxInput(value: string): Mailbox {
  const normalized = normalizeMailboxInputValue(value);
  if (!normalized) {
    return "inbox";
  }
  const alias = mailboxAliasLookup.get(normalized);
  if (alias) {
    return alias;
  }
  if (MAILBOX_VALUES.includes(normalized as Mailbox)) {
    return normalized as Mailbox;
  }
  throw new Error(`Dossier e-mail inconnu (${value}).`);
}

const mailboxInputSchema = z.preprocess((rawValue) => {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return "inbox";
  }
  return resolveMailboxInput(rawValue);
}, mailboxEnum);

function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const description = schema.description;
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const entries = Object.entries(shape).map(([key, value]) => [
      key,
      toJsonSchema(value),
    ]);
    const required = Object.entries(shape)
      .filter(([, value]) => !isOptionalSchema(value))
      .map(([key]) => key);
    return {
      type: "object",
      properties: Object.fromEntries(entries),
      required: required.length ? required : undefined,
      description,
    };
  }
  if (schema instanceof z.ZodString) {
    return { type: "string", description };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: "number", description };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean", description };
  }
  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema.options,
      description,
    };
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: toJsonSchema(schema.element as z.ZodTypeAny),
      description,
    };
  }
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return toJsonSchema(schema.unwrap() as z.ZodTypeAny);
  }
  if (schema instanceof z.ZodDefault) {
    return toJsonSchema(schema._def.innerType as z.ZodTypeAny);
  }
  return { type: "string", description };
}

function isOptionalSchema(schema: z.ZodTypeAny) {
  return (
    schema instanceof z.ZodOptional ||
    schema instanceof z.ZodNullable ||
    schema instanceof z.ZodDefault
  );
}

async function withAuditLogging<TInput>(
  toolName: string,
  actionLabel: string,
  userId: string,
  conversationId: string,
  handler: () => Promise<AssistantToolResult>,
  payload: TInput,
) {
  try {
    const result = await handler();
    await logAiAudit({
      toolName,
      actionLabel,
      userId,
      conversationId,
      payload,
      result: result.data ?? null,
      status: "SUCCESS",
    });
    return result;
  } catch (error) {
    await logAiAudit({
      toolName,
      actionLabel,
      userId,
      conversationId,
      payload,
      result: null,
      status: "ERROR",
      errorMessage:
        error instanceof Error ? error.message : "Outil indisponible",
    });
    throw error;
  }
}

const createClientSchema = z.object({
  displayName: stringField("Nom complet"),
  companyName: z.string().optional(),
  email: optionalEmail,
  phone: optionalPhone,
  vatNumber: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  source: z.nativeEnum(ClientSource).optional(),
  leadMetadata: z.record(z.string(), z.any()).optional(),
});

function buildClientPayload(
  input: z.infer<typeof createClientSchema>,
) {
  return {
    ...input,
    isActive: input.isActive ?? true,
    source: input.source ?? ClientSource.MANUAL,
    leadMetadata: input.leadMetadata ?? null,
  };
}

function clientCard(client: { id: string; displayName: string; email?: string | null; phone?: string | null }) {
  return {
    type: "client",
    title: client.displayName,
    subtitle: client.email ?? undefined,
    metadata: [
      ...(client.phone ? [{ label: "Téléphone", value: client.phone }] : []),
    ],
    href: `/clients/${client.id}/modifier`,
    actions: [
      {
        label: "Modifier",
        href: `/clients/${client.id}/modifier`,
      },
    ],
  } satisfies AssistantActionCard;
}

const createProductSchema = z.object({
  sku: stringField("Référence"),
  name: stringField("Nom du produit"),
  description: z.string().optional(),
  category: z.string().optional(),
  unit: stringField("Unité"),
  unitPrice: z.number().positive(),
  vatRate: z.number().min(0).max(100),
  defaultDiscountRate: z.number().min(0).max(90).optional(),
  isActive: z.boolean().optional(),
  isListedInCatalog: z.boolean().optional(),
  currency: z.string().optional(),
});

type CreateProductInput = z.infer<typeof createProductSchema>;

function productCard(product: {
  id: string;
  name: string;
  sku: string;
  priceHTCents: number;
  vatRate: number;
  currency: string;
}) {
  return {
    type: "product",
    title: product.name,
    subtitle: product.sku,
    metadata: [
      {
        label: "Prix HT",
        value: formatActionCardAmount(product.priceHTCents, product.currency),
      },
      {
        label: "TVA",
        value: `${product.vatRate}%`,
      },
    ],
    href: `/produits/${product.id}/modifier`,
    actions: [
      { label: "Modifier", href: `/produits/${product.id}/modifier` },
    ],
  } satisfies AssistantActionCard;
}

const PRODUCT_STRONG_MATCH_CONFIDENCE = 0.7;
const PRICE_TOLERANCE_RATIO = 0.01;
const PRICE_TOLERANCE_MIN = 50;

function computePriceTolerance(priceCents: number | null | undefined) {
  if (!priceCents || priceCents <= 0) {
    return null;
  }
  return Math.max(
    PRICE_TOLERANCE_MIN,
    Math.round(priceCents * PRICE_TOLERANCE_RATIO),
  );
}

function isPriceClose(
  candidatePriceCents: number | null | undefined,
  targetPriceCents: number,
  tolerance: number | null,
) {
  if (candidatePriceCents == null) {
    return false;
  }
  const diff = Math.abs(candidatePriceCents - targetPriceCents);
  return tolerance != null ? diff <= tolerance : diff === 0;
}

function buildProductSearchQuery(input: CreateProductInput, currency: string) {
  const parts: string[] = [];
  if (input.name?.trim()) {
    parts.push(input.name.trim());
  }
  if (input.sku?.trim()) {
    parts.push(input.sku.trim());
  }
  if (input.category?.trim()) {
    parts.push(input.category.trim());
  }
  if (Number.isFinite(input.unitPrice)) {
    parts.push(`${input.unitPrice} ${currency}`);
  }
  return parts.join(" ").trim();
}

async function findExistingProductForInput(
  input: CreateProductInput,
  userId: string,
) {
  const currency = input.currency?.trim() || getDefaultCurrencyCode();
  const priceHTCents = toCents(input.unitPrice, currency);
  const searchQuery =
    buildProductSearchQuery(input, currency) ||
    input.name ||
    input.sku ||
    input.category ||
    "";
  const { matches } = await searchProductsForAssistant(
    userId,
    searchQuery,
    10,
  );
  const normalizedName = normalizeSearchText(input.name);
  const normalizedSku = normalizeSearchText(input.sku);
  const normalizedCategory = normalizeSearchText(input.category ?? "");
  const priceTolerance = computePriceTolerance(priceHTCents);
  const annotated = matches.map((match) => {
    const matchName = normalizeSearchText(match.name);
    const matchSku = normalizeSearchText(match.sku ?? "");
    const matchCategory = normalizeSearchText(match.category ?? "");
    const skuExact = Boolean(normalizedSku) && matchSku === normalizedSku;
    const nameExact = Boolean(normalizedName) && matchName === normalizedName;
    const categoryExact =
      Boolean(normalizedCategory) && matchCategory === normalizedCategory;
    const priceClose = isPriceClose(
      match.priceHTCents,
      priceHTCents,
      priceTolerance,
    );
    const strong =
      skuExact ||
      (nameExact && priceClose) ||
      (nameExact && categoryExact) ||
      (priceClose && match.confidence >= PRODUCT_STRONG_MATCH_CONFIDENCE) ||
      match.confidence >= 0.9;
    return {
      ...match,
      skuExact,
      nameExact,
      categoryExact,
      priceClose,
      strong,
    };
  });
  const eligibleMatches = annotated.filter((match) => {
    const nameAligned =
      normalizedName &&
      normalizeSearchText(match.name) === normalizedName;
    const skuAligned =
      normalizedSku &&
      normalizeSearchText(match.sku ?? "") === normalizedSku;
    if (!nameAligned && !skuAligned) {
      return false;
    }
    const vatAligned = match.vatRate === input.vatRate;
    const priceAligned = match.priceClose;
    return vatAligned && priceAligned;
  });
  const bestMatch = eligibleMatches[0];
  if (!bestMatch) {
    return null;
  }
  const reasonParts: string[] = [];
  if (bestMatch.skuExact) reasonParts.push("SKU");
  if (bestMatch.nameExact) reasonParts.push("nom");
  if (bestMatch.categoryExact) reasonParts.push("catégorie");
  if (bestMatch.priceClose) reasonParts.push("prix");
  if (bestMatch.vatRate === input.vatRate) reasonParts.push("TVA");
  const reason = reasonParts.length
    ? reasonParts.join(", ")
    : bestMatch.matchFields?.join(", ") ?? "correspondance forte";
  return {
    match: bestMatch,
    currency,
    priceHTCents,
    reason,
  };
}

function buildProductPayload(input: CreateProductInput) {
  const currency = input.currency ?? getDefaultCurrencyCode();
  const priceHTCents = toCents(input.unitPrice, currency);
  const priceTTCCents = Math.round(
    priceHTCents * (1 + input.vatRate / 100),
  );
  return {
    sku: input.sku,
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? null,
    unit: input.unit,
    priceHTCents,
    priceTTCCents,
    vatRate: input.vatRate,
    defaultDiscountRate: input.defaultDiscountRate ?? null,
    isActive: input.isActive ?? true,
    isListedInCatalog: input.isListedInCatalog ?? true,
  };
}

function resolveDate(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

async function buildDocumentLines(
  lines: Array<z.infer<typeof productLineSchema>>,
  currency: string | undefined,
  userId: string,
) {
  const productIds = Array.from(
    new Set(
      lines
        .map((line) => line.productId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, userId },
        select: {
          id: true,
          priceHTCents: true,
          vatRate: true,
          unit: true,
        },
      })
    : [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  return lines.map((line, index) => {
    const product = line.productId ? productMap.get(line.productId) : null;
    const unitPriceHTCents = product
      ? product.priceHTCents
      : toCents(line.unitPrice, currency);
    const vatRate = product?.vatRate ?? line.vatRate;
    const unit = line.unit || product?.unit || "";

    return {
      productId: line.productId ?? null,
      description: line.description,
      quantity: line.quantity,
      unit,
      unitPriceHTCents,
      vatRate,
      discountRate: line.discountRate ?? null,
      position: index,
    };
  });
}

function quoteCard(quote: {
  id: string;
  number: string;
  totalTTCCents: number;
  currency: string;
  client: { displayName: string };
}) {
  return buildDocumentCard({
    type: "quote",
    title: `Devis ${quote.client.displayName}`,
    number: quote.number,
    totalCents: quote.totalTTCCents,
    currency: quote.currency,
    href: `/api/devis/${quote.id}/pdf`,
  });
}

function invoiceCard(invoice: {
  id: string;
  number: string;
  totalTTCCents: number;
  currency: string;
  client: { displayName: string };
}) {
  return buildDocumentCard({
    type: "invoice",
    title: `Facture ${invoice.client.displayName}`,
    number: invoice.number,
    totalCents: invoice.totalTTCCents,
    currency: invoice.currency,
    href: `/factures/${invoice.id}`,
  });
}

const toolDefinitions = [
  defineTool({
    name: "create_client",
    description:
      "Crée un client avec ses coordonnées pour l'utiliser dans des devis, factures ou e-mails.",
    parameters: createClientSchema,
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Créer le client ${input.displayName}${
        input.companyName ? ` (${input.companyName})` : ""
      }`,
    handler: async (input, context) =>
      withAuditLogging(
        "create_client",
        "Créer un client",
        context.userId,
        context.conversationId,
        async () => {
          const payload = buildClientPayload(input);
          const created = await createClient(payload);
          return {
            success: true,
            summary: `Client ${created.displayName} enregistré.`,
            data: { clientId: created.id },
            card: clientCard(created),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "update_client",
    description:
      "Met à jour les informations d'un client existant (adresse, TVA, coordonnées).",
    parameters: createClientSchema.extend({
      clientId: stringField("Identifiant client"),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Mettre à jour le client ${input.displayName}`,
    handler: async (input, context) =>
      withAuditLogging(
        "update_client",
        "Mettre à jour un client",
        context.userId,
        context.conversationId,
        async () => {
          const { clientId, ...rest } = input;
          const payload = buildClientPayload(rest);
          const updated = await updateClient(clientId, payload);
          return {
            success: true,
            summary: `Client ${updated.displayName} actualisé.`,
            data: { clientId: updated.id },
            card: clientCard(updated),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "search_clients",
    description:
      "Recherche les clients qui correspondent à un mot clé (nom, société, e-mail, téléphone).",
    parameters: z.object({
      query: stringField("Mot-clé").max(80),
      limit: z.number().min(1).max(25).default(8).optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "search_clients",
        "Rechercher des clients",
        context.userId,
        context.conversationId,
        async () => {
          const limit = input.limit ?? 8;
          const matches = await searchClientsForAssistant(
            context.userId,
            input.query,
            limit,
          );
          const best = matches[0];
          const summary =
            matches.length === 0
              ? "Aucun client correspondant."
              : matches.length === 1
                ? `Client identifié : ${best.displayName}`
                : `${matches.length} clients possibles. Confiance max ${Math.round(
                    best.confidence * 100,
                  )}%`;
          return {
            success: true,
            summary,
            data: {
              matches: matches.map((match) => ({
                id: match.id,
                displayName: match.displayName,
                companyName: match.companyName,
                email: match.email,
                phone: match.phone,
                vatNumber: match.vatNumber,
                confidence: Number(match.confidence.toFixed(2)),
                matchFields: match.matchFields,
              })),
            },
            requiresFollowUp: matches.length !== 1,
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "create_product",
    description: "Ajoute un produit/service avec prix HT/TVA prêts à être utilisés dans les documents.",
    parameters: createProductSchema,
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Créer le produit ${input.name} (${input.sku})`,
    handler: async (input, context) =>
      withAuditLogging(
        "create_product",
        "Créer un produit",
        context.userId,
        context.conversationId,
        async () => {
          const currency = input.currency ?? getDefaultCurrencyCode();
          const existing = await findExistingProductForInput(
            { ...input, currency },
            context.userId,
          );
          if (existing) {
            return {
              success: true,
              summary: `Produit existant réutilisé : ${existing.match.name} (${existing.match.sku}).`,
              data: { productId: existing.match.id, reused: true },
              metadata: [
                {
                  label: "Correspondance",
                  value: existing.reason,
                },
                {
                  label: "Confiance",
                  value: `${Math.round(existing.match.confidence * 100)}%`,
                },
              ],
              card: productCard({
                ...existing.match,
                currency: existing.match.currency ?? currency,
              }),
            };
          }
          const payload = buildProductPayload({ ...input, currency });
          const created = await createProduct(payload);
          return {
            success: true,
            summary: `Produit ${created.name} ajouté.`,
            data: { productId: created.id },
            card: productCard({
              ...created,
              currency,
            }),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "update_product",
    description: "Met à jour un produit existant (prix, TVA, description, disponibilité).",
    parameters: createProductSchema.extend({
      productId: stringField("Identifiant produit"),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Mettre à jour le produit ${input.name}`,
    handler: async (input, context) =>
      withAuditLogging(
        "update_product",
        "Mettre à jour un produit",
        context.userId,
        context.conversationId,
        async () => {
          const { productId, ...rest } = input;
          const currency = rest.currency ?? getDefaultCurrencyCode();
          const payload = buildProductPayload({ ...rest, currency });
          const updated = await updateProduct(productId, payload);
          return {
            success: true,
            summary: `Produit ${updated.name} mis à jour.`,
            data: { productId: updated.id },
            card: productCard({
              ...updated,
              currency,
            }),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "search_products",
    description: "Liste les produits correspondant à un mot-clé (nom, SKU, catégorie).",
    parameters: z.object({
      query: stringField("Mot-clé").max(80),
      limit: z.number().min(1).max(25).default(8).optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "search_products",
        "Rechercher des produits",
        context.userId,
        context.conversationId,
        async () => {
          const limit = input.limit ?? 8;
          const { matches, bestConfidence, hasExactMatch } = await searchProductsForAssistant(
            context.userId,
            input.query,
            limit,
          );
          const best = matches[0];
          const shouldCreateNew = !hasExactMatch && (matches.length === 0 || bestConfidence < 0.55);
          const bestConfidencePct = Math.round(bestConfidence * 100);
          const summary =
            matches.length === 0
              ? "Aucun produit trouvé."
              : hasExactMatch && matches.length === 1
                ? `Correspondance exacte : ${best.name}`
                : hasExactMatch
                  ? `${matches.length} correspondances exactes trouvées`
                  : matches.length === 1
                    ? shouldCreateNew
                      ? `Produit potentiel : ${best.name} (${bestConfidencePct}%)`
                      : `Produit identifié : ${best.name} (${bestConfidencePct}%)`
                    : `${matches.length} produits trouvés. Confiance max ${bestConfidencePct}%`;
          return {
            success: true,
            summary,
            data: {
              matches: matches.map((match) => ({
                id: match.id,
                name: match.name,
                sku: match.sku,
                category: match.category,
                unit: match.unit,
                priceHTCents: match.priceHTCents,
                vatRate: match.vatRate,
                currency: match.currency,
                confidence: Number(match.confidence.toFixed(2)),
                matchFields: match.matchFields,
              })),
              bestConfidence: Number(bestConfidence.toFixed(2)),
              hasExactMatch,
              shouldCreateNew,
            },
            requiresFollowUp:
              hasExactMatch ? matches.length !== 1 : matches.length !== 1 || shouldCreateNew,
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "create_quote",
    description: "Génère un devis avec lignes détaillées et calcul des taxes.",
    parameters: z.object({
      clientId: stringField("Client"),
      issueDate: z.string().optional(),
      validUntil: z.string().optional(),
      currency: z.string().optional(),
      status: z.nativeEnum(QuoteStatus).optional(),
      notes: z.string().optional(),
      terms: z.string().optional(),
      lines: z.array(productLineSchema).min(1),
      applyTimbre: z.boolean().optional(),
      timbreAmount: z.number().nonnegative().optional(),
    }),
    requiresConfirmation: true,
    confirmationSummary: () => "Créer un nouveau devis",
    handler: async (input, context) =>
      withAuditLogging(
        "create_quote",
        "Créer un devis",
        context.userId,
        context.conversationId,
        async () => {
          const taxes =
            input.applyTimbre === undefined && input.timbreAmount === undefined
              ? undefined
              : {
                  applyTimbre: input.applyTimbre,
                  timbreAmountCents:
                    input.timbreAmount === undefined
                      ? undefined
                      : toCents(input.timbreAmount, input.currency),
                };
          const lines = await buildDocumentLines(
            input.lines,
            input.currency,
            context.userId,
          );
          const quotePayload: QuoteInput = {
            clientId: input.clientId,
            status: input.status ?? QuoteStatus.BROUILLON,
            issueDate: resolveDate(input.issueDate) ?? new Date(),
            validUntil: resolveDate(input.validUntil) ?? undefined,
            currency: input.currency ?? "TND",
            notes: input.notes ?? null,
            terms: input.terms ?? null,
            lines,
            taxes,
          };
          const created = await createQuote(quotePayload);
          return {
            success: true,
            summary: `Devis ${created.number} créé.`,
            data: { quoteId: created.id },
            card: quoteCard(created as any),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "update_quote",
    description: "Met à jour un devis existant (statut, lignes, montants).",
    parameters: z.object({
      quoteId: stringField("Identifiant devis"),
      clientId: stringField("Client"),
      issueDate: z.string().optional(),
      validUntil: z.string().optional(),
      currency: z.string().optional(),
      status: z.nativeEnum(QuoteStatus).optional(),
      notes: z.string().optional(),
      terms: z.string().optional(),
      lines: z.array(productLineSchema).min(1),
      applyTimbre: z.boolean().optional(),
      timbreAmount: z.number().nonnegative().optional(),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Mettre à jour le devis ${input.quoteId}`,
    handler: async (input, context) =>
      withAuditLogging(
        "update_quote",
        "Mettre à jour un devis",
        context.userId,
        context.conversationId,
        async () => {
          const { quoteId, ...rest } = input;
          const taxes =
            rest.applyTimbre === undefined && rest.timbreAmount === undefined
              ? undefined
              : {
                  applyTimbre: rest.applyTimbre,
                  timbreAmountCents:
                    rest.timbreAmount === undefined
                      ? undefined
                      : toCents(rest.timbreAmount, rest.currency),
                };
          const lines = await buildDocumentLines(
            rest.lines,
            rest.currency,
            context.userId,
          );
          const quotePayload: QuoteInput = {
            ...rest,
            status: rest.status ?? QuoteStatus.BROUILLON,
            issueDate: resolveDate(rest.issueDate) ?? new Date(),
            validUntil: resolveDate(rest.validUntil) ?? undefined,
            currency: rest.currency ?? "TND",
            lines,
            taxes,
          };
          const updated = await updateQuote(quoteId, quotePayload);
          return {
            success: true,
            summary: `Devis ${updated.number} mis à jour.`,
            data: { quoteId: updated.id },
            card: quoteCard(updated as any),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "create_invoice",
    description: "Crée une facture (Brouillon par défaut) à partir de lignes détaillées.",
    parameters: z.object({
      clientId: stringField("Client"),
      issueDate: z.string().optional(),
      dueDate: z.string().optional(),
      currency: z.string().optional(),
      status: z.nativeEnum(InvoiceStatus).optional(),
      notes: z.string().optional(),
      terms: z.string().optional(),
      lines: z.array(productLineSchema).min(1),
      applyTimbre: z.boolean().optional(),
      timbreAmount: z.number().nonnegative().optional(),
    }),
    requiresConfirmation: true,
    confirmationSummary: () => "Créer une nouvelle facture",
    handler: async (input, context) =>
      withAuditLogging(
        "create_invoice",
        "Créer une facture",
        context.userId,
        context.conversationId,
        async () => {
          const taxes =
            input.applyTimbre === undefined && input.timbreAmount === undefined
              ? undefined
              : {
                  applyTimbre: input.applyTimbre,
                  timbreAmountCents:
                    input.timbreAmount === undefined
                      ? undefined
                      : toCents(input.timbreAmount, input.currency),
                };
          const lines = await buildDocumentLines(
            input.lines,
            input.currency,
            context.userId,
          );
          const invoicePayload: InvoiceInput = {
            clientId: input.clientId,
            status: input.status ?? InvoiceStatus.BROUILLON,
            issueDate: resolveDate(input.issueDate) ?? new Date(),
            dueDate: resolveDate(input.dueDate) ?? undefined,
            currency: input.currency ?? "TND",
            notes: input.notes ?? null,
            terms: input.terms ?? null,
            lines,
            taxes,
          };
          const created = await createInvoice(invoicePayload);
          return {
            success: true,
            summary: `Facture ${created.number} créée.`,
            data: { invoiceId: created.id },
            card: invoiceCard(created as any),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "update_invoice",
    description: "Met à jour une facture existante (montants, statut, échéance).",
    parameters: z.object({
      invoiceId: stringField("Identifiant facture"),
      clientId: stringField("Client"),
      issueDate: z.string().optional(),
      dueDate: z.string().optional(),
      currency: z.string().optional(),
      status: z.nativeEnum(InvoiceStatus).optional(),
      notes: z.string().optional(),
      terms: z.string().optional(),
      lines: z.array(productLineSchema).min(1),
      applyTimbre: z.boolean().optional(),
      timbreAmount: z.number().nonnegative().optional(),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Mettre à jour la facture ${input.invoiceId}`,
    handler: async (input, context) =>
      withAuditLogging(
        "update_invoice",
        "Mettre à jour une facture",
        context.userId,
        context.conversationId,
        async () => {
          const { invoiceId, ...rest } = input;
          const taxes =
            rest.applyTimbre === undefined && rest.timbreAmount === undefined
              ? undefined
              : {
                  applyTimbre: rest.applyTimbre,
                  timbreAmountCents:
                    rest.timbreAmount === undefined
                      ? undefined
                      : toCents(rest.timbreAmount, rest.currency),
                };
          const lines = await buildDocumentLines(
            rest.lines,
            rest.currency,
            context.userId,
          );
          const invoicePayload: InvoiceInput = {
            ...rest,
            status: rest.status ?? InvoiceStatus.BROUILLON,
            issueDate: resolveDate(rest.issueDate) ?? new Date(),
            dueDate: resolveDate(rest.dueDate) ?? undefined,
            currency: rest.currency ?? "TND",
            lines,
            taxes,
          };
          const updated = await updateInvoice(invoiceId, invoicePayload);
          return {
            success: true,
            summary: `Facture ${updated.number} actualisée.`,
            data: { invoiceId: updated.id },
            card: invoiceCard(updated as any),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "convert_quote_to_invoice",
    description: "Transforme un devis envoyé en facture prête à être finalisée.",
    parameters: z.object({
      quoteId: stringField("Identifiant devis"),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Convertir le devis ${input.quoteId} en facture`,
    handler: async (input, context) =>
      withAuditLogging(
        "convert_quote_to_invoice",
        "Convertir un devis en facture",
        context.userId,
        context.conversationId,
        async () => {
          const invoice = await convertQuoteToInvoice(input.quoteId);
          return {
            success: true,
            summary: `Facture ${invoice.number} générée depuis le devis.`,
            data: { invoiceId: invoice.id },
            card: invoiceCard(invoice as any),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "list_outstanding_invoices",
    description: "Retourne les factures impayées (envoyées, partielles ou en retard).",
    parameters: z.object({
      limit: z.number().min(1).max(25).default(10).optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "list_outstanding_invoices",
        "Lister les factures impayées",
        context.userId,
        context.conversationId,
        async () => {
          const statuses: InvoiceStatus[] = [
            InvoiceStatus.ENVOYEE,
            InvoiceStatus.PARTIELLE,
            InvoiceStatus.RETARD,
          ];
          const limit = input.limit ?? 10;
          const invoices = await prisma.invoice.findMany({
            where: {
              userId: context.userId,
              status: {
                in: statuses,
              },
            },
            orderBy: [
              { dueDate: "asc" },
              { issueDate: "asc" },
            ],
            take: limit,
            select: {
              id: true,
              number: true,
              status: true,
              totalTTCCents: true,
              amountPaidCents: true,
              currency: true,
              dueDate: true,
              client: {
                select: {
                  displayName: true,
                },
              },
            },
          });
          return {
            success: true,
            summary:
              invoices.length === 0
                ? "Aucune facture impayée."
                : `${invoices.length} facture(s) en attente.`,
            data: {
              invoices,
            },
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "duplicate_document",
    description: "Duplique un devis ou une facture pour gagner du temps.",
    parameters: z.object({
      documentId: stringField("Identifiant"),
      documentType: z.enum(["quote", "invoice"]),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Dupliquer ${input.documentType === "quote" ? "le devis" : "la facture"} ${input.documentId}`,
    handler: async (input, context) =>
      withAuditLogging(
        "duplicate_document",
        "Dupliquer un document",
        context.userId,
        context.conversationId,
        async () => {
          if (input.documentType === "quote") {
            const duplicated = await duplicateQuote(input.documentId);
            return {
              success: true,
              summary: `Devis ${duplicated.number} créé en double.`,
              data: { quoteId: duplicated.id },
              card: quoteCard(duplicated as any),
            };
          }
          const duplicated = await duplicateInvoice(input.documentId);
          return {
            success: true,
            summary: `Facture ${duplicated.number} dupliquée.`,
            data: { invoiceId: duplicated.id },
            card: invoiceCard(duplicated as any),
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "get_recent_mailbox_emails",
    description:
      "Récupère automatiquement les derniers e-mails d'un dossier (réception, envoyés, brouillons, spam, corbeille).",
    parameters: z.object({
      mailbox: mailboxInputSchema.optional().default("inbox"),
      limit: z.number().int().min(3).max(10).optional(),
    }),
    handler: async (input, context) => {
      const mailbox = input.mailbox ?? "inbox";
      const limit = input.limit ?? 6;
      return withAuditLogging(
        "get_recent_mailbox_emails",
        "Lister les e-mails d'un dossier",
        context.userId,
        context.conversationId,
        async () => {
          const result = await fetchRecentMailboxEmails({
            mailbox,
            limit,
            userId: context.userId,
          });
          const folderLabel = getMailboxDisplayName(mailbox);
          return {
            success: true,
            summary:
              result.emails.length === 0
                ? `${folderLabel} : aucun e-mail récent.`
                : `${result.emails.length} e-mail(s) récents trouvés dans ${folderLabel}.`,
            data: {
              mailbox: result.mailbox,
              mailboxLabel: folderLabel,
              totalMessages: result.totalMessages,
              limit: result.limit,
              emails: result.emails,
              errors: result.errors,
            },
          };
        },
        { ...input, mailbox, limit },
      );
    },
  }),
  defineTool({
    name: "get_scheduled_emails",
    description:
      "Retourne les e-mails planifiés/programmé (Planifiés) pour vérifier les prochains envois.",
    parameters: z.object({
      limit: z.number().int().min(1).max(25).optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "get_scheduled_emails",
        "Lister les e-mails planifiés",
        context.userId,
        context.conversationId,
        async () => {
          const limit = input.limit ?? 10;
          const items = await listScheduledEmails(context.userId);
          const selected = items.slice(0, limit);
          return {
            success: true,
            summary:
              items.length === 0
                ? "Aucun e-mail planifié."
                : `${selected.length} e-mail(s) planifiés listés (${items.length} au total).`,
            data: {
              total: items.length,
              emails: selected,
            },
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "summarize_email_thread",
    description: "Récupère le contenu d'un e-mail (depuis la messagerie) pour permettre un résumé.",
    parameters: z.object({
      mailbox: z.enum(["inbox", "sent", "drafts", "trash", "spam"]),
      uid: z.number().int().nonnegative(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "summarize_email_thread",
        "Analyser un e-mail",
        context.userId,
        context.conversationId,
        async () => {
          const detail = await fetchMessageDetail({
            mailbox: input.mailbox as Mailbox,
            uid: input.uid,
            userId: context.userId,
          });
          return {
            success: true,
            summary: `Conversation « ${detail.subject} » récupérée.`,
            data: {
              subject: detail.subject,
              from: detail.from,
              to: detail.to,
              cc: detail.cc,
              date: detail.date,
              textPreview: detail.text?.slice(0, 1200),
            },
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "draft_email_reply",
    description: "Génère un brouillon d'e-mail à partir d'un texte proposé.",
    parameters: z.object({
      to: z.array(stringField("Destinataire")).min(1),
      subject: stringField("Sujet"),
      body: stringField("Contenu du message"),
      relatedDocumentId: z.string().optional(),
      mailbox: z.enum(["inbox", "sent", "drafts", "trash", "spam"]).optional(),
      uid: z.number().int().optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "draft_email_reply",
        "Préparer un brouillon d'e-mail",
        context.userId,
        context.conversationId,
        async () => ({
          success: true,
          summary: "Brouillon prêt à être relu.",
          data: {
            to: input.to,
            subject: input.subject,
            body: input.body,
            relatedDocumentId: input.relatedDocumentId ?? null,
          },
          card: {
            type: "email",
            title: input.subject,
            subtitle: input.to.join(", "),
            metadata: [
              {
                label: "Corps",
                value: input.body.slice(0, 160) + (input.body.length > 160 ? "…" : ""),
              },
            ],
            actions: [
              { label: "Ouvrir la messagerie", href: "/messagerie/nouveau-message" },
            ],
          },
        }),
        input,
      ),
  }),
  defineTool({
    name: "send_email_message",
    description:
      "Envoie un e-mail personnalisé après validation de l'utilisateur (hors devis/factures).",
    parameters: z.object({
      to: z.array(baseEmail).min(1),
      cc: z.array(baseEmail).optional(),
      bcc: z.array(baseEmail).optional(),
      subject: stringField("Sujet"),
      body: stringField("Contenu du message"),
      scheduleFor: z
        .string()
        .trim()
        .min(1, "Indiquez une date ou heure de planification.")
        .max(160, "Formulation de planification trop longue.")
        .optional(),
      sendNow: z.boolean().optional(),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) => {
      const base = `Envoyer un e-mail à ${input.to.join(", ")} (sujet : ${input.subject})`;
      if (input.scheduleFor && !input.sendNow) {
        return `${base} — planifié (« ${input.scheduleFor} »)`;
      }
      if (input.sendNow) {
        return `${base} — envoi immédiat`;
      }
      return base;
    },
    handler: async (input, context) =>
      withAuditLogging(
        "send_email_message",
        "Envoyer un e-mail personnalisé",
        context.userId,
        context.conversationId,
        async () => {
          const timezone = context.timezone ?? DEFAULT_TIMEZONE;
          const htmlBody = convertPlainTextToHtml(input.body);
          const scheduleText = input.scheduleFor?.trim();
          const forceImmediate = input.sendNow === true;
          const shouldSchedule = Boolean(scheduleText) && !forceImmediate;
          const recipientLabel =
            input.to.length === 1
              ? input.to[0]
              : `${input.to.length} destinataires`;

          if (shouldSchedule && scheduleText) {
            try {
              const parsed = parseRequestedSendTime({
                text: scheduleText,
                timezone,
              });
              if (!parsed) {
                throw new Error(
                  `Impossible de comprendre la date ou l'heure demandée (« ${scheduleText} »). Reformulez ou donnez un horaire précis.`,
                );
              }
              const messagingSummary =
                await getMessagingSettingsSummary(context.userId);
              if (!messagingSummary.smtpConfigured) {
                throw new Error(
                  "Configurez la messagerie (SMTP) avant de planifier un envoi.",
                );
              }
              const record = await scheduleEmailDraft({
                userId: context.userId,
                to: input.to,
                cc: input.cc,
                bcc: input.bcc,
                subject: input.subject,
                text: input.body,
                html: htmlBody,
                sendAt: parsed.sendAt,
                attachments: [],
              });
              const formattedTime = formatScheduledTime(parsed.sendAt, timezone);
              return {
                success: true,
                summary: `E-mail à ${recipientLabel} planifié pour ${formattedTime}.`,
                data: {
                  to: input.to,
                  cc: input.cc ?? [],
                  bcc: input.bcc ?? [],
                  subject: input.subject,
                  scheduled: true,
                  sendAt: record.sendAt,
                  timezone,
                  scheduledEmailId: record.id,
                  requestedSchedule: scheduleText,
                },
                card: {
                  type: "email",
                  title: input.subject,
                  subtitle: `${input.to.join(", ")} • Planifié`,
                  metadata: [
                    {
                      label: "Planification",
                      value: formattedTime,
                    },
                    {
                      label: "Corps",
                      value: summarizeEmailBody(input.body, 200),
                    },
                  ],
                },
              };
            } catch (error) {
              console.warn("[assistant-email-schedule] Scheduling failed", error);
              if (error instanceof Error) {
                throw error;
              }
              throw new Error("Impossible de planifier cet e-mail.");
            }
          }

          try {
            const sendResult = await sendEmailMessageForUser(
              context.userId,
              {
                to: input.to,
                cc: input.cc,
                bcc: input.bcc,
                subject: input.subject,
                text: input.body,
                html: htmlBody,
              },
            );
            return {
              success: true,
              summary: `E-mail envoyé à ${recipientLabel}.`,
              data: {
                to: input.to,
                cc: input.cc ?? [],
                bcc: input.bcc ?? [],
                subject: input.subject,
                message: sendResult.message,
                totalMessages: sendResult.totalMessages,
                scheduled: false,
                timezone,
              },
              card: {
                type: "email",
                title: input.subject,
                subtitle: input.to.join(", "),
                metadata: [
                  {
                    label: "Corps",
                    value: summarizeEmailBody(input.body, 200),
                  },
                ],
              },
            };
          } catch (error) {
            console.warn("[assistant-email-send] Sending failed", error);
            throw new Error(mapMessagingSendError(error));
          }
        },
        input,
      ),
  }),
  defineTool({
    name: "send_email_with_invoice_or_quote",
    description: "Envoie un e-mail contenant un devis ou une facture (format PDF).",
    parameters: z.object({
      documentType: z.enum(["quote", "invoice"]),
      documentId: stringField("Identifiant"),
      to: z
        .array(baseEmail)
        .min(1)
        .max(1, "Un seul destinataire est pris en charge par envoi."),
      subject: stringField("Sujet proposé").optional(),
    }),
    requiresConfirmation: true,
    confirmationSummary: (input) =>
      `Envoyer ${input.documentType === "quote" ? "le devis" : "la facture"} ${input.documentId} par e-mail`,
    handler: async (input, context) =>
      withAuditLogging(
        "send_email_with_invoice_or_quote",
        "Envoyer un document",
        context.userId,
        context.conversationId,
        async () => {
          const recipient = input.to[0]!;
          const [messagingSummary, document] = await Promise.all([
            getMessagingSettingsSummary(context.userId),
            input.documentType === "quote"
              ? prisma.quote.findFirst({
                  where: { id: input.documentId, userId: context.userId },
                  select: { id: true, number: true },
                })
              : prisma.invoice.findFirst({
                  where: { id: input.documentId, userId: context.userId },
                  select: { id: true, number: true },
                }),
          ]);
          if (!messagingSummary.smtpConfigured) {
            throw new Error(
              "Configurez la messagerie (SMTP) avant d'envoyer un email.",
            );
          }
          if (!document) {
            throw new Error(
              input.documentType === "quote"
                ? "Devis introuvable."
                : "Facture introuvable.",
            );
          }
          const queueResult =
            input.documentType === "quote"
              ? await queueQuoteEmailJob({
                  userId: context.userId,
                  quoteId: input.documentId,
                  to: recipient,
                  subject: input.subject,
                })
              : await queueInvoiceEmailJob({
                  userId: context.userId,
                  invoiceId: input.documentId,
                  to: recipient,
                  subject: input.subject,
                });
          const label =
            input.documentType === "quote" ? "Devis" : "Facture";
          const summary = queueResult.deduped
            ? `${label} déjà en file d'envoi (${document.number ?? document.id}).`
            : `${label} ${document.number ?? document.id} en file d'envoi.`;
          const payloadData: Prisma.InputJsonObject = {
            documentId: document.id,
            documentNumber: document.number ?? null,
            to: recipient,
            jobId: queueResult.jobId,
            deduped: queueResult.deduped,
            ...(input.documentType === "quote"
              ? { quoteId: document.id }
              : { invoiceId: document.id }),
          };
          return {
            success: true,
            summary,
            data: payloadData,
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "get_recent_emails_from_sender",
    description: "Retourne les e-mails récents échangés avec une adresse donnée (basé sur l'historique d'envoi).",
    parameters: z.object({
      email: baseEmail,
      limit: z.number().min(1).max(20).default(5).optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "get_recent_emails_from_sender",
        "Consulter l'historique d'e-mails",
        context.userId,
        context.conversationId,
        async () => {
          const limit = input.limit ?? 5;
          const entries = await prisma.messagingEmail.findMany({
            where: {
              userId: context.userId,
              recipients: {
                some: {
                  address: {
                    equals: input.email,
                    mode: "insensitive",
                  },
                },
              },
            },
            orderBy: { sentAt: "desc" },
            take: limit,
            select: {
              subject: true,
              sentAt: true,
            },
          });
          return {
            success: true,
            summary:
              entries.length === 0
                ? "Aucun envoi récent vers cette adresse."
                : `${entries.length} e-mails retrouvés.`,
            data: {
              emails: entries,
            },
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "classify_email_intent",
    description: "(Optionnel) Déduit l'intention probable d'un e-mail à partir de son sujet/contenu.",
    parameters: z.object({
      subject: stringField("Sujet").optional(),
      body: stringField("Corps").optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "classify_email_intent",
        "Classifier un e-mail",
        context.userId,
        context.conversationId,
        async () => {
          const text = `${input.subject ?? ""} ${input.body ?? ""}`.toLowerCase();
          let intent: string = "information";
          if (/relance|rappel|impay|retard/.test(text)) {
            intent = "relance";
          } else if (/devis|offre|proposition/.test(text)) {
            intent = "demande_devis";
          } else if (/facture|paiement|règlement/.test(text)) {
            intent = "facturation";
          } else if (/merci|félicitations|bravo/.test(text)) {
            intent = "satisfaction";
          }
          return {
            success: true,
            summary: `Intention détectée: ${intent}`,
            data: { intent },
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "open_page",
    description: "Propose une URL interne pertinente (client, facture, devis, produit, messagerie).",
    parameters: z.object({
      entityType: z.enum(["dashboard", "client", "invoice", "quote", "product", "email", "assistant"]),
      entityId: z.string().optional(),
    }),
    handler: async (input) => {
      const base = {
        dashboard: "/tableau-de-bord",
        client: input.entityId ? `/clients/${input.entityId}/modifier` : "/clients",
        invoice: input.entityId ? `/factures/${input.entityId}` : "/factures",
        quote: input.entityId ? `/devis/${input.entityId}` : "/devis",
        product: input.entityId ? `/produits/${input.entityId}/modifier` : "/produits",
        email: "/messagerie",
        assistant: "/assistant",
      } as const;
      const href = base[input.entityType];
      return {
        success: true,
        summary: `Ouvrir ${href}`,
        data: { href },
        card: {
          type: "navigation",
          title: "Navigation suggérée",
          subtitle: href,
          actions: [{ label: "Ouvrir", href }],
        },
      };
    },
  }),
  defineTool({
    name: "search_documents",
    description: "Recherche rapide parmi les numéros de factures/devis et les noms de clients.",
    parameters: z.object({
      query: stringField("Mot-clé").max(80),
      limit: z.number().min(1).max(15).default(8).optional(),
    }),
    handler: async (input, context) =>
      withAuditLogging(
        "search_documents",
        "Rechercher des documents",
        context.userId,
        context.conversationId,
        async () => {
          const limit = input.limit ?? 8;
          const [invoices, quotes] = await Promise.all([
            prisma.invoice.findMany({
              where: {
                userId: context.userId,
                OR: [
                  { number: { contains: input.query, mode: "insensitive" } },
                  { client: { displayName: { contains: input.query, mode: "insensitive" } } },
                ],
              },
              orderBy: { issueDate: "desc" },
              take: Math.ceil(limit / 2),
              select: {
                id: true,
                number: true,
                client: { select: { displayName: true } },
                totalTTCCents: true,
                currency: true,
              },
            }),
            prisma.quote.findMany({
              where: {
                userId: context.userId,
                OR: [
                  { number: { contains: input.query, mode: "insensitive" } },
                  { client: { displayName: { contains: input.query, mode: "insensitive" } } },
                ],
              },
              orderBy: { issueDate: "desc" },
              take: Math.ceil(limit / 2),
              select: {
                id: true,
                number: true,
                client: { select: { displayName: true } },
                totalTTCCents: true,
                currency: true,
              },
            }),
          ]);
          return {
            success: true,
            summary: `${invoices.length} facture(s) et ${quotes.length} devis trouvés.`,
            data: {
              invoices,
              quotes,
            },
          };
        },
        input,
      ),
  }),
  defineTool({
    name: "validate_tax_summary",
    description: "Vérifie que le calcul TVA/FODEC est cohérent avec les montants fournis.",
    parameters: z.object({
      lines: z
        .array(
          z.object({
            baseHT: z.number().nonnegative(),
            vatRate: z.number().min(0).max(100),
            expectedTVA: z.number().nonnegative(),
          }),
        )
        .min(1),
      fodecRate: z.number().min(0).max(100).optional(),
      timbreAmount: z.number().nonnegative().optional(),
    }),
    handler: async (input) => {
      const recalculated = input.lines.map((line) => {
        const tva = line.baseHT * (line.vatRate / 100);
        const diff = Math.abs(tva - line.expectedTVA);
        return {
          ...line,
          computedTVA: tva,
          withinTolerance: diff < 0.05,
        };
      });
      const allValid = recalculated.every((line) => line.withinTolerance);
      return {
        success: allValid,
        summary: allValid
          ? "TVA cohérente."
          : "Certaines lignes nécessitent une vérification.",
        data: {
          lines: recalculated,
          fodecRate: input.fodecRate ?? null,
          timbreAmount: input.timbreAmount ?? null,
        },
      };
    },
  }),
  defineTool({
    name: "convert_currency",
    description: "Convertit un montant entre devises principales (TND, EUR, USD, GBP, CAD).",
    parameters: z.object({
      amount: z.number().nonnegative(),
      fromCurrency: z.enum(["TND", "EUR", "USD", "GBP", "CAD"]),
      toCurrency: z.enum(["TND", "EUR", "USD", "GBP", "CAD"]),
    }),
    handler: async (input) => {
      const converted = convertAmount(
        input.amount,
        input.fromCurrency,
        input.toCurrency,
      );
      return {
        success: true,
        summary: `${input.amount} ${input.fromCurrency} = ${converted.toFixed(3)} ${input.toCurrency}`,
        data: {
          amount: input.amount,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          converted,
        },
      };
    },
  }),
] satisfies AssistantToolDefinition[];

const tools: AssistantToolDefinition[] = toolDefinitions;

export function getAssistantTools(): AssistantToolDefinition[] {
  return tools;
}

export function getToolByName(name: string): AssistantToolDefinition | null {
  const tool = tools.find((entry) => entry.name === name);
  return tool ?? null;
}

export function serializeToolSchemas() {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toJsonSchema(tool.parameters),
  }));
}
