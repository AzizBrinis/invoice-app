import {
  ClientSource,
  InvoiceStatus,
  Prisma,
  QuoteStatus,
} from "@prisma/client";
import { ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import type {
  AssistantContentBlock,
  AssistantMessage,
  AssistantStreamEvent,
} from "@/types/assistant";
import {
  ensureConversation,
  loadConversationMessages,
  persistAssistantMessage,
  updateConversationTitleIfNeeded,
} from "@/server/assistant/conversations";
import {
  getToolByName,
  serializeToolSchemas,
} from "@/server/assistant/tools";
import { callSelectedModel } from "@/server/assistant/providers";
import type {
  AssistantContextInput,
  LLMMessage,
  LLMToolCall,
} from "@/server/assistant/types";
import { assistantConfig } from "@/server/assistant/config";
import {
  enforceUsageLimit,
  incrementUsage,
} from "@/server/assistant/usage";
import {
  createPendingToolCall,
  consumePendingToolCall,
} from "@/server/assistant/pending-tools";
import type { AssistantToolResult } from "@/server/assistant/types";
import { logAiAudit } from "@/server/assistant/audit";
import { normalizeTimezone } from "@/lib/timezone";
import { getDefaultCurrencyCode } from "@/lib/currency";
import {
  evaluateScopeRequest,
  type ScopeHistoryEntry,
} from "@/server/assistant/scope";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getSettings } from "@/server/settings";
import { createHash } from "crypto";

type AssistantRequest = {
  conversationId?: string;
  message?: string;
  context?: AssistantContextInput | null;
  confirmToolCallId?: string;
  clientTimezone?: string | null;
};

function extractTimbrePreferenceFromText(
  text?: string | null,
): boolean | null {
  if (!text) {
    return null;
  }
  const normalized = text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized.includes("timbre")) {
    return null;
  }
  const negativePatterns = [
    "sans timbre",
    "pas de timbre",
    "pas timbre",
    "ne pas appliquer le timbre",
    "ne pas mettre le timbre",
    "ne mets pas le timbre",
    "retire le timbre",
    "retirer le timbre",
    "retirez le timbre",
    "supprime le timbre",
    "enlever le timbre",
    "enleve le timbre",
    "desactive le timbre",
    "désactive le timbre",
  ];
  if (negativePatterns.some((pattern) => normalized.includes(pattern))) {
    return false;
  }
  const positivePatterns = [
    "avec timbre",
    "inclure le timbre",
    "ajoute le timbre",
    "ajouter le timbre",
    "appliquer le timbre",
    "applique le timbre",
    "met le timbre",
  ];
  if (positivePatterns.some((pattern) => normalized.includes(pattern))) {
    return true;
  }
  return null;
}

function formatZodIssues(error: ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "champ";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function formatToolError(error: unknown): string {
  if (error instanceof ZodError) {
    return `Paramètres invalides: ${formatZodIssues(error)}`;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return "Élément introuvable. Vérifiez l'identifiant fourni.";
    }
    if (error.code === "P2002") {
      return "Conflit avec un enregistrement existant (doublon).";
    }
  }
  if (error instanceof Error) {
    return error.message || "Action impossible.";
  }
  return "Action impossible. Vérifiez les informations fournies.";
}

function contentToText(blocks: AssistantContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "text") {
        return block.text;
      }
      if (block.type === "action-card") {
        const metadata = block.card.metadata
          ?.map((entry) => `${entry.label}: ${entry.value}`)
          .join(" | ");
        return `[Carte ${block.card.type}] ${block.card.title} ${metadata ?? ""}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatToolMessageText(result: AssistantToolResult): string {
  const parts: string[] = [];
  if (result.summary?.trim()) {
    parts.push(result.summary.trim());
  }
  if (result.data) {
    try {
      parts.push(JSON.stringify(result.data));
    } catch {
      // Ignore serialization errors and stick to the summary only.
    }
  }
  return parts.join(" | ");
}

function normalizeAssistantText(raw: string): string {
  const withoutCodeFences = raw.replace(
    /```[\w-]*\n?([\s\S]*?)```/g,
    (_match, content) => (content ? content.trim() : ""),
  );
  const withoutLatex = withoutCodeFences
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\$([^\n$]+)\$/g, "$1");
  const normalizedWhitespace = withoutLatex
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ");
  const normalizedLines = normalizedWhitespace
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/^[ \t]+/, "").replace(/[ \t]+$/g, "");
      const bulletMatch = trimmed.match(/^([-*]|•)\s*/);
      if (bulletMatch) {
        const content = trimmed.slice(bulletMatch[0].length).trim();
        return content ? `- ${content}` : "-";
      }
      const numberedMatch = trimmed.match(/^(\d+)[.)]\s*/);
      if (numberedMatch) {
        const content = trimmed.slice(numberedMatch[0].length).trim();
        return content ? `${numberedMatch[1]}. ${content}` : `${numberedMatch[1]}.`;
      }
      return trimmed.replace(/[ \t]{2,}/g, " ");
    })
    .join("\n");
  const compact = normalizedLines
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n +/g, "\n");
  return compact.trim();
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJson(entry));
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJson((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function areJsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(sortJson(a)) === JSON.stringify(sortJson(b));
  } catch {
    return false;
  }
}

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return JSON.parse(JSON.stringify(String(value))) as Prisma.InputJsonValue;
  }
}

export function normalizeToolInput(
  toolName: string,
  input: unknown,
  options?: { lastUserMessage?: string | null; timbrePreference?: boolean | null },
): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }
  if (toolName === "create_client") {
    const raw = input as Record<string, unknown>;
    const normalizeText = (value: unknown) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };
    return {
      displayName: normalizeText(raw.displayName) ?? "",
      companyName: normalizeText(raw.companyName),
      email: normalizeText(raw.email),
      phone: normalizeText(raw.phone),
      vatNumber: normalizeText(raw.vatNumber),
      address: normalizeText(raw.address),
      notes: normalizeText(raw.notes),
      isActive:
        typeof raw.isActive === "boolean" ? raw.isActive : true,
      source:
        typeof raw.source === "string"
          ? (raw.source as ClientSource)
          : ClientSource.MANUAL,
      leadMetadata:
        raw.leadMetadata === undefined
          ? null
          : (raw.leadMetadata as Record<string, unknown> | null),
    };
  }
  if (toolName === "create_product") {
    const raw = input as Record<string, unknown>;
    const normalizeText = (value: unknown) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };
    const normalizeNumber = (value: unknown) =>
      typeof value === "number" ? Number(value) : Number(value ?? 0);
    const normalizeBoolean = (value: unknown, fallback: boolean) =>
      typeof value === "boolean" ? value : fallback;
    return {
      sku: normalizeText(raw.sku) ?? "",
      name: normalizeText(raw.name) ?? "",
      description: normalizeText(raw.description),
      category: normalizeText(raw.category),
      unit: normalizeText(raw.unit) ?? "",
      unitPrice: normalizeNumber(raw.unitPrice),
      vatRate: normalizeNumber(raw.vatRate),
      defaultDiscountRate:
        raw.defaultDiscountRate === undefined || raw.defaultDiscountRate === null
          ? null
          : normalizeNumber(raw.defaultDiscountRate),
      isActive: normalizeBoolean(raw.isActive, true),
      isListedInCatalog: normalizeBoolean(raw.isListedInCatalog, true),
      currency: (normalizeText(raw.currency) ?? "TND").toUpperCase(),
    };
  }
  if (toolName === "create_quote" || toolName === "create_invoice") {
    const raw = input as Record<string, unknown>;
    const normalizeText = (value: unknown) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };
    const normalizeNumber = (value: unknown) =>
      typeof value === "number" ? Number(value) : Number(value ?? 0);
    const normalizeOptionalNumber = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Number(value);
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };
    const normalizeBooleanFlag = (value: unknown) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
          return null;
        }
        if (
          ["oui", "true", "vrai", "with", "enable", "activer", "avec", "yes"].includes(
            normalized,
          ) ||
          normalized.includes("avec") ||
          (normalized.includes("timbre") && normalized.includes("avec"))
        ) {
          return true;
        }
        if (
          ["non", "false", "faux", "disable", "desactiver", "désactiver", "sans", "no"].includes(
            normalized,
          ) ||
          normalized.includes("sans") ||
          normalized.includes("pas de timbre") ||
          (normalized.includes("timbre") && normalized.includes("pas")) ||
          (normalized.includes("timbre") && normalized.includes("sans"))
        ) {
          return false;
        }
      }
      return null;
  };
    const normalizeTimbreFlag = () => {
      const candidateValues = [
        raw.applyTimbre,
        raw.apply_stamp_duty,
        raw.applyStampDuty,
        raw.stampDuty,
        raw.timbre,
        raw.timbreFiscal,
        raw.timbre_fiscal,
        raw["timbre fiscal"],
        (raw.taxes as Record<string, unknown> | undefined)?.applyTimbre,
        (raw.taxes as Record<string, unknown> | undefined)?.timbre,
        (raw.taxes as Record<string, unknown> | undefined)?.timbreFiscal,
        (raw.taxes as Record<string, unknown> | undefined)?.timbre_fiscal,
        (raw.taxes as Record<string, unknown> | undefined)?.apply_stamp_duty,
        (raw.taxes as Record<string, unknown> | undefined)?.applyStampDuty,
        raw.intent,
        raw.notes,
      ];
      for (const value of candidateValues) {
        const flag = normalizeBooleanFlag(value);
        if (flag !== null) {
          return flag;
        }
      }
      return null;
    };
    const normalizedLines = Array.isArray(raw.lines)
      ? (raw.lines as Array<Record<string, unknown>>).map((line) => ({
          productId: normalizeText(line.productId),
          description: normalizeText(line.description) ?? "",
          quantity: normalizeNumber(line.quantity),
          unit: normalizeText(line.unit) ?? "",
          unitPrice: normalizeNumber(line.unitPrice),
          vatRate: normalizeNumber(line.vatRate),
          discountRate:
            line.discountRate === undefined || line.discountRate === null
              ? null
              : normalizeNumber(line.discountRate),
        }))
      : [];
    const timbreFlag =
      options?.timbrePreference ??
      extractTimbrePreferenceFromText(options?.lastUserMessage) ??
      normalizeTimbreFlag();
    const base = {
      clientId: normalizeText(raw.clientId) ?? "",
      issueDate: normalizeText(raw.issueDate),
      currency: (normalizeText(raw.currency) ?? "TND")?.toUpperCase(),
      notes: normalizeText(raw.notes),
      terms: normalizeText(raw.terms),
      lines: normalizedLines,
      // Timbre fiscal must be applied by default unless the user explicitly opts out.
      applyTimbre: timbreFlag ?? true,
      timbreAmount:
        normalizeOptionalNumber(
          raw.timbreAmount ??
            (raw.taxes as Record<string, unknown> | undefined)?.timbreAmount ??
            raw.timbreAmountCents,
        ) ?? undefined,
    };
    if (toolName === "create_quote") {
      return {
        ...base,
        validUntil: normalizeText(raw.validUntil),
        status:
          normalizeText(raw.status) ??
          QuoteStatus.BROUILLON,
      };
    }
    return {
      ...base,
      dueDate: normalizeText(raw.dueDate),
      status:
        normalizeText(raw.status) ??
        InvoiceStatus.BROUILLON,
    };
  }
  return input;
}

function hashNormalizedInput(value: unknown): string {
  try {
    const serialized = JSON.stringify(sortJson(value));
    return createHash("sha256").update(serialized).digest("hex");
  } catch {
    return "";
  }
}

function findLastUserMessageText(messages: LLMMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (
      candidate.role === "user" &&
      typeof candidate.content === "string" &&
      candidate.content.trim()
    ) {
      return candidate.content;
    }
  }
  return null;
}

function resolveTimbrePreferenceFromMessages(
  messages: LLMMessage[],
  latestUserMessage?: string | null,
): boolean | null {
  const candidates: string[] = [];
  if (latestUserMessage?.trim()) {
    candidates.push(latestUserMessage.trim());
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (entry.role !== "user") {
      continue;
    }
    if (typeof entry.content !== "string") {
      continue;
    }
    const content = entry.content.trim();
    if (content) {
      candidates.push(content);
    }
  }
  for (const candidate of candidates) {
    const preference = extractTimbrePreferenceFromText(candidate);
    if (preference !== null) {
      return preference;
    }
  }
  return null;
}

async function findLatestEntityIds(params: {
  conversationId: string;
  userId: string;
}) {
  const recentTools = await prisma.aIMessage.findMany({
    where: {
      userId: params.userId,
      conversationId: params.conversationId,
      role: "TOOL",
      metadata: {
        not: Prisma.JsonNull,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      toolName: true,
      metadata: true,
    },
  });

  let clientId: string | null = null;
  let productId: string | null = null;
  let quoteId: string | null = null;
  let invoiceId: string | null = null;

  for (const entry of recentTools) {
    const data = (entry.metadata as Record<string, unknown> | null)?.data;
    if (!data || typeof data !== "object") continue;
    if (!clientId && typeof (data as Record<string, unknown>).clientId === "string") {
      clientId = (data as Record<string, unknown>).clientId as string;
    }
    if (!productId && typeof (data as Record<string, unknown>).productId === "string") {
      productId = (data as Record<string, unknown>).productId as string;
    }
    if (!quoteId && typeof (data as Record<string, unknown>).quoteId === "string") {
      quoteId = (data as Record<string, unknown>).quoteId as string;
    }
    if (!invoiceId && typeof (data as Record<string, unknown>).invoiceId === "string") {
      invoiceId = (data as Record<string, unknown>).invoiceId as string;
    }
    if (clientId && productId && quoteId && invoiceId) {
      break;
    }
  }

  return { clientId, productId, quoteId, invoiceId };
}

async function buildCompletionSummary(params: {
  conversationId: string;
  userId: string;
}) {
  const { clientId, productId, quoteId, invoiceId } =
    await findLatestEntityIds(params);

  const [client, product, quote, invoice, settings] = await Promise.all([
    clientId
      ? prisma.client.findFirst({
          where: { id: clientId, userId: params.userId },
          select: { displayName: true },
        })
      : null,
    productId
      ? prisma.product.findFirst({
          where: { id: productId, userId: params.userId },
          select: {
            name: true,
            priceHTCents: true,
          },
        })
      : null,
    quoteId
      ? prisma.quote.findFirst({
          where: { id: quoteId, userId: params.userId },
          select: { id: true, number: true, currency: true },
        })
      : null,
    invoiceId
      ? prisma.invoice.findFirst({
          where: { id: invoiceId, userId: params.userId },
          select: { id: true, number: true, currency: true },
        })
      : null,
    getSettings(params.userId),
  ]);

  const productCurrency =
    invoice?.currency ??
    quote?.currency ??
    settings?.defaultCurrency ??
    getDefaultCurrencyCode();
  const productPrice = product
    ? formatCurrency(
        fromCents(product.priceHTCents, productCurrency),
        productCurrency,
      )
    : null;

  const lines = [
    client
      ? `• Client créé : ${client.displayName}`
      : clientId
        ? `• Client créé (ID: ${clientId})`
        : null,
    product
      ? `• Produit ajouté : ${product.name} – ${productPrice}`
      : productId
        ? `• Produit ajouté (ID: ${productId})`
        : null,
    quote
      ? `• Devis créé : ${quote.number}`
      : quoteId
        ? `• Devis créé (ID: ${quoteId})`
        : null,
    invoice
      ? `• Facture créée : ${invoice.number}`
      : invoiceId
        ? `• Facture créée (ID: ${invoiceId})`
        : null,
  ].filter(Boolean);

  const body = lines.length
    ? lines.join("\n")
    : "Création terminée.";

  return `Création terminée. Résumé :\n${body}`;
}

function buildScopeHistory(
  history: AssistantMessage[],
): ScopeHistoryEntry[] {
  return history
    .filter((message) => message.role === "user")
    .map((message) => ({
      text: contentToText(message.content),
      metadata: message.metadata ?? null,
    }));
}

function mapHistoryToMessages(
  history: AssistantMessage[],
): LLMMessage[] {
  const messages: LLMMessage[] = [
    {
      role: "system",
      content: assistantConfig.systemPrompt,
    },
  ];
  history.forEach((message) => {
    const textContent = contentToText(message.content);
    if (!textContent) {
      return;
    }
    if (message.role === "tool") {
      messages.push({
        role: "assistant",
        content: message.toolName
          ? `Outil ${message.toolName}: ${textContent}`
          : textContent,
      });
      return;
    }
    messages.push({
      role: message.role,
      content: textContent,
    });
  });
  return messages;
}

function getLastUserIntent(
  history: AssistantMessage[],
): string | null {
  const lastUser = [...history].reverse().find(
    (message) => message.role === "user",
  );
  if (!lastUser) {
    return null;
  }
  const intent = contentToText(lastUser.content).trim();
  return intent || null;
}

function buildContinuationHint(history: AssistantMessage[]): string | null {
  const intent = getLastUserIntent(history);
  if (!intent) {
    return null;
  }
  return [
    "Poursuis automatiquement la demande ci-dessus jusqu'au résultat final.",
    "Si plusieurs actions sont nécessaires (client, produit, devis ou facture), enchaîne-les sans t'arrêter après une seule confirmation.",
    "Réutilise les identifiants et données déjà obtenus; s'il manque une information essentielle, pose une question brève puis continue.",
    "Termine en confirmant l'élément final créé avec son lien ou numéro.",
  ].join(" ");
}

function extractWorkflowEntities(history: AssistantMessage[]): {
  clientId: string | null;
  productId: string | null;
  invoiceId: string | null;
} {
  const state: {
    clientId: string | null;
    productId: string | null;
    invoiceId: string | null;
  } = {
    clientId: null,
    productId: null,
    invoiceId: null,
  };
  for (const message of [...history].reverse()) {
    if (message.role !== "tool") continue;
    const data = message.metadata?.data as
      | Record<string, unknown>
      | undefined
      | null;
    if (data) {
      if (!state.clientId && typeof data.clientId === "string") {
        state.clientId = data.clientId;
      }
      if (!state.productId && typeof data.productId === "string") {
        state.productId = data.productId;
      }
      if (!state.invoiceId && typeof data.invoiceId === "string") {
        state.invoiceId = data.invoiceId;
      }
    }
  }
  return state;
}

function buildWorkflowContinuationHint(
  history: AssistantMessage[],
): string | null {
  const { clientId, productId, invoiceId } =
    extractWorkflowEntities(history);
  if (!clientId && !productId) {
    return null;
  }
  const intent = getLastUserIntent(history)?.toLowerCase() ?? "";
  const wantsInvoice =
    intent.includes("facture") ||
    intent.includes("invoice") ||
    intent.includes("facturation");
  const steps: string[] = [];
  if (clientId) {
    steps.push(`client créé (ID: ${clientId})`);
  }
  if (productId) {
    steps.push(`produit créé (ID: ${productId})`);
  }
  if (invoiceId) {
    steps.push(`facture créée (ID: ${invoiceId})`);
  }
  const hints: string[] = [];
  if (steps.length) {
    hints.push(`Étapes terminées: ${steps.join(" ; ")}.`);
  }
  if (!invoiceId && wantsInvoice && clientId && productId) {
    hints.push(
      "Passe directement à la facture en réutilisant ce client et ce produit sans redemander de confirmation pour des éléments déjà créés.",
    );
  } else {
    hints.push(
      "Ne relance pas la création des entités déjà terminées dans cette conversation.",
    );
  }
  return hints.filter(Boolean).join(" ");
}

async function streamTextMessage(
  text: string,
  conversationId: string,
  emit: (event: AssistantStreamEvent) => void,
) {
  const chunks = text.split(/(?<=[.?!])/u).filter(Boolean);
  for (const chunk of chunks) {
    emit({
      type: "message_token",
      delta: chunk,
      conversationId,
    });
  }
}

async function persistAssistantText(
  params: {
    userId: string;
    conversationId: string;
    text: string;
  },
) {
  const normalizedText = normalizeAssistantText(params.text);
  return persistAssistantMessage({
    userId: params.userId,
    conversationId: params.conversationId,
    role: "assistant",
    content: [
      {
        type: "text",
        text: normalizedText,
      },
    ],
  });
}

async function deliverAssistantMessage(params: {
  userId: string;
  conversationId: string;
  text: string;
  emit: (event: AssistantStreamEvent) => void;
}) {
  const normalizedText =
    normalizeAssistantText(params.text) ||
    "Je n'ai pas pu générer de réponse.";
  await streamTextMessage(
    normalizedText,
    params.conversationId,
    params.emit,
  );
  const saved = await persistAssistantText({
    userId: params.userId,
    conversationId: params.conversationId,
    text: normalizedText,
  });
  if (saved) {
    params.emit({
      type: "message_complete",
      message: saved,
      conversationId: params.conversationId,
    });
  }
}

const OUT_OF_SCOPE_RESPONSE =
  "Je suis un assistant dédié à votre application de facturation, CRM et messagerie. Je peux uniquement vous aider pour les modules clients, produits, devis, factures, messagerie, tableau de bord, paramètres ou site web. Reformulez votre demande dans ce cadre.";

async function respondOutOfScope(params: {
  conversationId: string;
  userId: string;
  emit: (event: AssistantStreamEvent) => void;
}) {
  await deliverAssistantMessage({
    userId: params.userId,
    conversationId: params.conversationId,
    text: OUT_OF_SCOPE_RESPONSE,
    emit: params.emit,
  });
}

async function executeToolCall(
  toolCall: LLMToolCall,
  conversationId: string,
  userId: string,
  timezone: string,
  lastUserMessage: string | null,
  timbrePreference: boolean | null,
  emit: (event: AssistantStreamEvent) => void,
): Promise<AssistantToolResult | "pending"> {
  const tool = getToolByName(toolCall.name);
  if (!tool) {
    throw new Error(`Outil inconnu: ${toolCall.name}`);
  }
    const parsed = tool.parameters.safeParse(toolCall.arguments);
    if (!parsed.success) {
      const errorMessage = formatZodIssues(parsed.error);
      await logAiAudit({
        toolName: tool.name,
      actionLabel: tool.name,
      userId,
      conversationId,
      payload: toolCall.arguments,
      result: null,
      status: "ERROR",
      errorMessage,
    }).catch(() => undefined);
    throw parsed.error;
  }
  const parsedInput = parsed.data as unknown;
  const normalizedInput = normalizeToolInput(tool.name, parsedInput, {
    lastUserMessage,
    timbrePreference,
  });
  const normalizedHash = hashNormalizedInput(normalizedInput);

  // Prevent duplicate confirmations/executions for identical inputs
  if (tool.requiresConfirmation) {
    const previousMatches = await prisma.aIMessage.findMany({
      where: {
        userId,
        conversationId,
        role: "TOOL",
        toolName: tool.name,
        metadata: {
          not: Prisma.JsonNull,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { metadata: true },
    });
    const reused = previousMatches
      .map((entry) => entry.metadata as Record<string, unknown> | null)
      .find((meta) => {
        const priorArgs =
          meta?.argumentsNormalized ?? meta?.arguments ?? null;
        const priorHash =
          typeof meta?.argumentsNormalizedHash === "string"
            ? meta.argumentsNormalizedHash
            : null;
        if (priorHash && priorHash === normalizedHash && normalizedHash) {
          return true;
        }
        return Boolean(priorArgs && areJsonEqual(priorArgs, normalizedInput));
      });
    if (reused) {
      const summary =
        typeof reused.summary === "string" && reused.summary.trim()
          ? reused.summary
          : `Action ${tool.name} déjà réalisée.`;
      const data =
        reused.data === undefined
          ? undefined
          : toJsonValue(reused.data);
      emit({
        type: "tool_result",
        toolName: tool.name,
        result: data ?? null,
        conversationId,
      });
      await persistAssistantMessage({
        userId,
        conversationId,
        role: "tool",
        toolName: tool.name,
        toolCallId: toolCall.id,
        content: [
          {
            type: "text",
            text: summary,
          },
        ],
        metadata: toJsonValue({
          summary,
          data: data ?? null,
          arguments: parsedInput,
          reused: true,
        }),
      });
      return {
        success: true,
        summary,
        data,
      };
    }
  }

  if (tool.requiresConfirmation) {
    const summary = tool.confirmationSummary
      ? tool.confirmationSummary(parsedInput as never)
      : `Confirmer l'action ${tool.name}`;
    const pending = await createPendingToolCall({
      userId,
      conversationId,
      toolName: tool.name,
      summary,
      arguments: normalizedInput as Prisma.InputJsonValue,
    });
    emit({
      type: "confirmation_required",
      confirmation: {
        id: pending.id,
        toolName: pending.toolName,
        summary: pending.summary,
        createdAt: pending.createdAt.toISOString(),
        arguments: pending.arguments as Record<string, unknown>,
      },
      conversationId,
    });
    await persistAssistantMessage({
      userId,
      conversationId,
      role: "assistant",
      content: [
        {
          type: "text",
          text: `${summary}. Confirmez avant exécution.`,
        },
      ],
    });
    return "pending";
  }
  const result = await tool.handler(normalizedInput as never, {
    userId,
    conversationId,
    timezone,
  });
      emit({
        type: "tool_result",
        toolName: tool.name,
        result: result.data ?? null,
        conversationId,
      });
  if (result.card) {
    emit({
      type: "action_card",
      card: result.card,
      conversationId,
    });
  }
  await persistAssistantMessage({
    userId,
    conversationId,
    role: "tool",
    toolName: tool.name,
    toolCallId: toolCall.id,
    content: [
      {
        type: "text",
        text: formatToolMessageText(result),
      },
    ],
    metadata: toJsonValue({
      summary: result.summary,
      data: result.data ?? null,
      arguments: normalizedInput,
      argumentsNormalized: normalizedInput,
      argumentsNormalizedHash: normalizedHash ?? null,
    }),
  });
  await incrementUsage({
    userId,
    toolInvocations: 1,
  });
  return result;
}

async function runModelLoop(params: {
  messages: LLMMessage[];
  conversationId: string;
  userId: string;
  timezone: string;
  latestUserMessageText?: string | null;
  emit: (event: AssistantStreamEvent) => void;
}) {
  let iterations = 0;
  while (iterations < assistantConfig.maxToolIterations) {
    iterations += 1;
    const response = await callSelectedModel({
      messages: params.messages,
      tools: serializeToolSchemas(),
    });

    const assistantMessage: LLMMessage = {
      role: "assistant",
      content: response.content,
    };
    if (response.toolCalls?.length) {
      assistantMessage.toolCalls = response.toolCalls;
    }
    params.messages.push(assistantMessage);

    if (response.toolCalls?.length) {
      const lastUserMessage =
        params.latestUserMessageText ?? findLastUserMessageText(params.messages);
      const timbrePreference = resolveTimbrePreferenceFromMessages(
        params.messages,
        params.latestUserMessageText,
      );
      let toolExecutionFailed = false;
      for (const call of response.toolCalls) {
        let toolResult: AssistantToolResult | "pending";
        try {
          toolResult = await executeToolCall(
            call,
            params.conversationId,
            params.userId,
            params.timezone,
            lastUserMessage,
            timbrePreference,
            params.emit,
          );
        } catch (error) {
          const message = formatToolError(error);
          params.emit({
            type: "error",
            message,
            conversationId: params.conversationId,
          });
          await persistAssistantMessage({
            userId: params.userId,
            conversationId: params.conversationId,
            role: "tool",
            toolName: call.name,
            toolCallId: call.id,
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: true, message }),
              },
            ],
            metadata: {
              summary: message,
              error: true,
            },
          });
          params.messages.push({
            role: "tool",
            content: JSON.stringify({
              error: true,
              message,
            }),
            name: call.name,
            tool_call_id: call.id,
          });
          toolExecutionFailed = true;
          break;
        }
        if (toolResult === "pending") {
          return;
        }
        params.messages.push({
          role: "tool",
          content: JSON.stringify({
            summary: toolResult.summary,
            data: toolResult.data ?? null,
          }),
          name: call.name,
          tool_call_id: call.id,
        });
        if (
          (call.name === "create_quote" || call.name === "create_invoice") &&
          toolResult.success
        ) {
          const summaryText = await buildCompletionSummary({
            userId: params.userId,
            conversationId: params.conversationId,
          });
          await deliverAssistantMessage({
            userId: params.userId,
            conversationId: params.conversationId,
            text: summaryText,
            emit: params.emit,
          });
          return;
        }
      }
      if (toolExecutionFailed) {
        continue;
      }
      continue;
    }

    await deliverAssistantMessage({
      userId: params.userId,
      conversationId: params.conversationId,
      text: response.content ?? "",
      emit: params.emit,
    });
    await incrementUsage({
      userId: params.userId,
      tokens: response.tokens ?? undefined,
    });
    return;
  }
  params.emit({
    type: "error",
    message: "Boucle d'outils interrompue.",
    conversationId: params.conversationId,
  });
}

export async function runAssistantTurn(
  payload: AssistantRequest,
  emit: (event: AssistantStreamEvent) => void,
) {
  const user = await requireUser();
  const timezone = normalizeTimezone(payload.clientTimezone);
  const conversation = await ensureConversation(
    user.id,
    payload.conversationId,
  );
  const usage = await enforceUsageLimit(user.id);
  emit({
    type: "usage",
    usage,
    conversationId: conversation.id,
  });

  if (payload.confirmToolCallId) {
    const pending = await consumePendingToolCall({
      userId: user.id,
      pendingId: payload.confirmToolCallId,
    });
    if (!pending) {
      emit({
        type: "error",
        message: "Action à confirmer introuvable.",
        conversationId: conversation.id,
      });
      return;
    }
    const tool = getToolByName(pending.toolName);
    if (!tool) {
      emit({
        type: "error",
        message: "Outil indisponible.",
        conversationId: conversation.id,
      });
      return;
    }
    const storedInput = pending.arguments as unknown;
    const normalizedStoredInput = normalizeToolInput(
      pending.toolName,
      storedInput,
      {
        timbrePreference:
          typeof (storedInput as Record<string, unknown> | null)?.applyTimbre === "boolean"
            ? ((storedInput as Record<string, unknown>).applyTimbre as boolean)
            : null,
      },
    );
    const result = await tool.handler(
      normalizedStoredInput as never,
      {
        userId: user.id,
        conversationId: conversation.id,
        timezone,
      },
    );
    emit({
      type: "tool_result",
      toolName: pending.toolName,
      result: result.data ?? null,
      conversationId: conversation.id,
    });
    if (result.card) {
      emit({
        type: "action_card",
        card: result.card,
        conversationId: conversation.id,
      });
    }
    await persistAssistantMessage({
      userId: user.id,
      conversationId: conversation.id,
      role: "tool",
      toolName: pending.toolName,
      content: [
        {
          type: "text",
          text: formatToolMessageText(result),
        },
      ],
      metadata: toJsonValue({
        summary: result.summary,
        data: result.data ?? null,
        arguments: normalizedStoredInput,
        argumentsNormalized: normalizeToolInput(
          pending.toolName,
          storedInput,
        ),
        argumentsNormalizedHash: hashNormalizedInput(
          normalizeToolInput(pending.toolName, storedInput),
        ) ?? null,
      }),
    });
    await incrementUsage({
      userId: user.id,
      toolInvocations: 1,
    });
    if (
      (pending.toolName === "create_quote" ||
        pending.toolName === "create_invoice") &&
      result.success
    ) {
      const summaryText = await buildCompletionSummary({
        userId: user.id,
        conversationId: conversation.id,
      });
      await deliverAssistantMessage({
        userId: user.id,
        conversationId: conversation.id,
        text: summaryText,
        emit,
      });
      return;
    }
    const history = await loadConversationMessages(
      user.id,
      conversation.id,
    );
    const continuationHint = buildContinuationHint(history);
    const workflowHint = buildWorkflowContinuationHint(history);
    const messages = mapHistoryToMessages(history);
    const combinedHint = [continuationHint, workflowHint]
      .filter(Boolean)
      .join("\n");
    if (combinedHint) {
      messages.push({
        role: "user",
        content: combinedHint,
      });
    }
    await runModelLoop({
      userId: user.id,
      conversationId: conversation.id,
      messages,
      timezone,
      latestUserMessageText: getLastUserIntent(history),
      emit,
    });
    return;
  }

  if (!payload.message?.trim()) {
    emit({
      type: "error",
      message: "Message vide.",
      conversationId: conversation.id,
    });
    return;
  }

  const trimmedMessage = payload.message.trim();
  const history = await loadConversationMessages(
    user.id,
    conversation.id,
  );
  const scopeEvaluation = evaluateScopeRequest({
    history: buildScopeHistory(history),
    text: trimmedMessage,
    context: payload.context,
  });

  const userMessageBlocks: AssistantContentBlock[] = [
    {
      type: "text",
      text: trimmedMessage,
    },
  ];
  const savedMessage = await persistAssistantMessage({
    userId: user.id,
    conversationId: conversation.id,
    role: "user",
    content: userMessageBlocks,
    metadata: scopeEvaluation.metadata as Prisma.InputJsonValue,
  });
  if (savedMessage) {
    await updateConversationTitleIfNeeded({
      conversationId: conversation.id,
      userId: user.id,
      candidate: payload.message.slice(0, 80),
    });
  }
  await incrementUsage({
    userId: user.id,
    messageCount: 1,
  });

  if (!scopeEvaluation.allowed) {
    await respondOutOfScope({
      conversationId: conversation.id,
      userId: user.id,
      emit,
    });
    return;
  }

  const historyWithNewMessage = savedMessage
    ? [...history, savedMessage]
    : history;
  const messages = mapHistoryToMessages(historyWithNewMessage);
  await runModelLoop({
    messages,
    emit,
    userId: user.id,
    conversationId: conversation.id,
    timezone,
    latestUserMessageText: trimmedMessage,
  });
}
