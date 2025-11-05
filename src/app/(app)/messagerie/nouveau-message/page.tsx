import sanitizeHtml from "sanitize-html";
import {
  fetchMessageDetail,
  getMessagingSettingsSummary,
  type MessageDetail,
  type Mailbox,
  type MessageParticipant,
} from "@/server/messaging";
import { listSavedResponses } from "@/server/messaging-responses";
import { ComposeClient } from "@/app/(app)/messagerie/_components/compose-client";
import {
  parseRecipientHeaders,
  type RecipientDraft,
} from "@/lib/messaging/recipients";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type NouveauMessagePageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

type ComposeInitialDraft = {
  to?: RecipientDraft[];
  cc?: RecipientDraft[];
  bcc?: RecipientDraft[];
  subject?: string;
  body?: string;
  quotedHtml?: string;
  quotedText?: string;
};

const SUPPORTED_MAILBOXES: Mailbox[] = ["inbox", "sent"];

function isSupportedMailbox(value: string | undefined): value is Mailbox {
  return !!value && SUPPORTED_MAILBOXES.includes(value as Mailbox);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function buildQuotedSections(detail: MessageDetail): {
  html: string;
  text: string;
} {
  const metadataParts: string[] = [];
  if (detail.from) {
    metadataParts.push(`<div><strong>De :</strong> ${escapeHtml(detail.from)}</div>`);
  }
  if (detail.to.length) {
    metadataParts.push(
      `<div><strong>À :</strong> ${escapeHtml(detail.to.join(", "))}</div>`,
    );
  }
  if (detail.cc.length) {
    metadataParts.push(
      `<div><strong>Cc :</strong> ${escapeHtml(detail.cc.join(", "))}</div>`,
    );
  }
  metadataParts.push(
    `<div><strong>Date :</strong> ${escapeHtml(formatDateTime(detail.date))}</div>`,
  );
  metadataParts.push(
    `<div><strong>Objet :</strong> ${escapeHtml(detail.subject)}</div>`,
  );

  const bodyHtml = detail.html
    ? detail.html
    : `<pre style="white-space:pre-wrap;">${escapeHtml(detail.text ?? "")}</pre>`;

  const html = `<div style="margin-bottom:12px;">${metadataParts.join("")}</div>${bodyHtml}`;
  const text =
    detail.text ?? sanitizeHtml(detail.html ?? "", { allowedTags: [], allowedAttributes: {} });

  return { html, text };
}

function prefixSubject(original: string, prefix: string): string {
  const normalized = original.trim();
  if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
    return normalized;
  }
  return `${prefix} ${normalized}`;
}

function toRecipientDraftsFromStrings(
  values: Array<string | null | undefined>,
): RecipientDraft[] {
  return parseRecipientHeaders(
    values.filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    ),
  );
}

function participantsToRecipients(
  participants: Array<MessageParticipant | null | undefined>,
  fallback: Array<string | null | undefined>,
): RecipientDraft[] {
  const normalized = participants
    .map((participant) => {
      if (!participant?.address) {
        return null;
      }
      const address = participant.address.trim();
      if (!address) {
        return null;
      }
      const display = participant.name?.trim() ?? address;
      return {
        display,
        address,
      } satisfies RecipientDraft;
    })
    .filter((value): value is RecipientDraft => Boolean(value));

  if (normalized.length > 0) {
    return normalized;
  }

  return toRecipientDraftsFromStrings(fallback);
}

function collectRecipients(
  groups: RecipientDraft[][],
  senderEmail?: string,
): RecipientDraft[] {
  const normalizedSender = senderEmail?.trim().toLowerCase() ?? null;
  const seen = new Set<string>();
  const result: RecipientDraft[] = [];

  for (const group of groups) {
    for (const recipient of group) {
      const address = recipient.address.trim();
      if (!address) {
        continue;
      }
      const normalized = address.toLowerCase();
      if (normalizedSender && normalized === normalizedSender) {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push({
        display: recipient.display.trim() || address,
        address,
      });
    }
  }

  return result;
}

function buildInitialDraft(
  mode: string,
  detail: MessageDetail,
  senderEmail?: string,
): ComposeInitialDraft {
  const { html: quotedHtml, text: quotedText } = buildQuotedSections(detail);
  const baseDraft: ComposeInitialDraft = {
    body: "",
    quotedHtml,
    quotedText,
  };

  const replyRecipients = participantsToRecipients(
    detail.replyToAddresses,
    detail.replyTo,
  );
  const fromRecipients = participantsToRecipients(
    [detail.fromAddress],
    [detail.from],
  );
  const toRecipients = participantsToRecipients(detail.toAddresses, detail.to);
  const ccRecipients = participantsToRecipients(detail.ccAddresses, detail.cc);

  switch (mode) {
    case "reply": {
      const to = collectRecipients(
        [replyRecipients, fromRecipients, toRecipients, ccRecipients],
        senderEmail,
      );
      return {
        ...baseDraft,
        to: to.length
          ? to
          : toRecipients.length
            ? toRecipients.slice(0, 1)
            : fromRecipients.slice(0, 1),
        cc: [],
        bcc: [],
        subject: prefixSubject(detail.subject, "Re:"),
      };
    }
    case "reply_all": {
      const primaryPool = replyRecipients.length
        ? replyRecipients
        : fromRecipients;
      const combined = collectRecipients(
        [primaryPool, toRecipients, ccRecipients],
        senderEmail,
      );
      const to = combined.slice(0, 1);
      const cc = combined.slice(1);
      return {
        ...baseDraft,
        to: to.length
          ? to
          : fromRecipients.length
            ? fromRecipients.slice(0, 1)
            : toRecipients.slice(0, 1),
        cc,
        bcc: [],
        subject: prefixSubject(detail.subject, "Re:"),
      };
    }
    case "forward": {
      return {
        ...baseDraft,
        to: [],
        cc: [],
        bcc: [],
        subject: prefixSubject(detail.subject, "Fwd:"),
      };
    }
    default:
      return baseDraft;
  }
}

export default async function NouveauMessagePage({
  searchParams,
}: NouveauMessagePageProps) {
  const summary = await getMessagingSettingsSummary();
  const companySettings = await getSettings();

  const resolvedSearchParams =
    searchParams && typeof (searchParams as Promise<unknown>).then === "function"
      ? await (searchParams as Promise<Record<string, string | string[] | undefined>>)
      : ((searchParams ?? {}) as Record<string, string | string[] | undefined>);

  const modeParam =
    typeof resolvedSearchParams.mode === "string"
      ? resolvedSearchParams.mode
      : undefined;
  const mailboxParam =
    typeof resolvedSearchParams.mailbox === "string"
      ? (resolvedSearchParams.mailbox as string)
      : undefined;
  const uidParam =
    typeof resolvedSearchParams.uid === "string" ? resolvedSearchParams.uid : undefined;

  let initialDraft: ComposeInitialDraft | null = null;

  if (modeParam && mailboxParam && uidParam && isSupportedMailbox(mailboxParam)) {
    const uidValue = Number.parseInt(uidParam, 10);
    if (Number.isInteger(uidValue)) {
      try {
        const detail = await fetchMessageDetail({
          mailbox: mailboxParam,
          uid: uidValue,
        });
        initialDraft = buildInitialDraft(modeParam, detail, summary.fromEmail);
      } catch (error) {
        console.error("Impossible de préparer la réponse:", error);
      }
    }
  }

  const savedResponses = await listSavedResponses();
  const companyPlaceholderValues = {
    company_name: companySettings.companyName?.trim() ?? "",
    company_email: companySettings.email?.trim() ?? "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
  };

  if (!initialDraft) {
    const toParam = resolvedSearchParams.to;
    const rawValues = Array.isArray(toParam) ? toParam : toParam ? [toParam] : [];
    const parsedRecipients = parseRecipientHeaders(
      rawValues.flatMap((value) => {
        if (typeof value !== "string") {
          return [];
        }
        return value
          .split(/[;,]/)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      }),
    );
    if (parsedRecipients.length > 0) {
      initialDraft = {
        to: parsedRecipients,
        body: "",
      };
    }
  }

  return (
    <ComposeClient
      fromEmail={summary.fromEmail}
      senderName={summary.senderName}
      smtpConfigured={summary.smtpConfigured}
      initialDraft={initialDraft}
      savedResponses={savedResponses}
      companyPlaceholders={companyPlaceholderValues}
    />
  );
}
