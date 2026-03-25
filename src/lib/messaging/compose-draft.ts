import sanitizeHtml from "sanitize-html";
import type {
  MessageDetail,
  MessageParticipant,
} from "@/server/messaging";
import {
  parseRecipientHeaders,
  type RecipientDraft,
} from "@/lib/messaging/recipients";

export type ComposeInitialDraft = {
  to?: RecipientDraft[];
  cc?: RecipientDraft[];
  bcc?: RecipientDraft[];
  subject?: string;
  body?: string;
  quotedHtml?: string;
  quotedText?: string;
  quotedHeaderHtml?: string;
  quotedHeaderText?: string;
};

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
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildQuotedSections(detail: MessageDetail): {
  html: string;
  text: string;
  headerHtml: string;
  headerText: string;
} {
  const senderName =
    detail.fromAddress?.name?.trim() ||
    detail.from?.trim() ||
    detail.fromAddress?.address?.trim() ||
    "the sender";
  const senderEmail = detail.fromAddress?.address?.trim();
  const senderLabel =
    senderEmail && senderEmail.length
      ? `${senderName} <${senderEmail}>`
      : senderName;

  const formattedDate = formatDateTime(detail.date);
  const headerText = `On ${formattedDate}, ${senderLabel} wrote:`;
  const headerHtml = `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#475569;font-weight:600;">${escapeHtml(
    headerText,
  )}</p>`;

  const bodyHtml = detail.html
    ? detail.html
    : `<pre style="white-space:pre-wrap;">${escapeHtml(detail.text ?? "")}</pre>`;
  const text =
    detail.text ??
    sanitizeHtml(detail.html ?? "", {
      allowedTags: [],
      allowedAttributes: {},
    });

  return { html: bodyHtml, text, headerHtml, headerText };
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
  senderEmail?: string | null,
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

export function buildInitialComposeDraft(
  mode: string,
  detail: MessageDetail,
  senderEmail?: string | null,
): ComposeInitialDraft {
  const {
    html: quotedHtml,
    text: quotedText,
    headerHtml: quotedHeaderHtml,
    headerText: quotedHeaderText,
  } = buildQuotedSections(detail);
  const baseDraft: ComposeInitialDraft = {
    body: "",
    quotedHtml,
    quotedText,
    quotedHeaderHtml,
    quotedHeaderText,
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
      const primaryReplyPool = replyRecipients.length
        ? replyRecipients
        : fromRecipients.length
          ? fromRecipients
          : toRecipients;
      const to = collectRecipients([primaryReplyPool], senderEmail);
      return {
        ...baseDraft,
        to: to.length ? to : toRecipients.slice(0, 1),
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
