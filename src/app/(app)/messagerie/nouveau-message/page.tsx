import sanitizeHtml from "sanitize-html";
import {
  fetchMessageDetail,
  getMessagingSettingsSummary,
  listAttachableDocuments,
  type MessageDetail,
  type Mailbox,
} from "@/server/messaging";
import { ComposeClient } from "@/app/(app)/messagerie/_components/compose-client";

export const dynamic = "force-dynamic";

type NouveauMessagePageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

type ComposeInitialDraft = {
  to?: string[];
  cc?: string[];
  bcc?: string[];
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

function extractAddressIdentifier(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

function buildReplyAllRecipients(
  detail: MessageDetail,
  senderEmail?: string,
): { to: string[]; cc: string[] } {
  const participants = [detail.from, ...detail.to, ...detail.cc].filter(
    (entry): entry is string => Boolean(entry && entry.trim().length > 0),
  );
  if (participants.length === 0) {
    return { to: [], cc: [] };
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const participant of participants) {
    const identifier = extractAddressIdentifier(participant);
    if (identifier && identifier === senderEmail?.toLowerCase()) {
      continue;
    }
    if (!seen.has(identifier)) {
      seen.add(identifier);
      unique.push(participant);
    }
  }

  if (unique.length === 0) {
    return { to: [], cc: [] };
  }

  const primary = detail.from && unique.includes(detail.from)
    ? detail.from
    : unique[0];
  const to = [primary];
  const cc = unique.filter((entry) => entry !== primary);

  return { to, cc };
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

  switch (mode) {
    case "reply": {
      const to = detail.from
        ? [detail.from]
        : detail.to.length
          ? detail.to
          : [];
      return {
        ...baseDraft,
        to,
        cc: [],
        bcc: [],
        subject: prefixSubject(detail.subject, "Re:"),
      };
    }
    case "reply_all": {
      const { to, cc } = buildReplyAllRecipients(detail, senderEmail);
      return {
        ...baseDraft,
        to: to.length ? to : detail.from ? [detail.from] : [],
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
  const documents = await listAttachableDocuments();

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

  return (
    <ComposeClient
      fromEmail={summary.fromEmail}
      senderName={summary.senderName}
      smtpConfigured={summary.smtpConfigured}
      initialDraft={initialDraft}
      quickReplies={summary.quickReplies}
      responseTemplates={summary.responseTemplates}
      documents={documents}
      signature={summary.signature}
      signatureHtml={summary.signatureHtml}
    />
  );
}
