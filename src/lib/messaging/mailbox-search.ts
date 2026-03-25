import type { SearchObject } from "imapflow";

export const MAILBOX_SEARCHABLE_VALUES = [
  "inbox",
  "sent",
] as const;

export type SearchableMailbox = (typeof MAILBOX_SEARCHABLE_VALUES)[number];

const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u001F\u007F]+/g;
const MULTI_SPACE_PATTERN = /\s+/g;
const EMAILISH_PATTERN =
  /[@._+-]|(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;

export function isMailboxSearchable(
  value: string | null | undefined,
): value is SearchableMailbox {
  return MAILBOX_SEARCHABLE_VALUES.includes(
    value as SearchableMailbox,
  );
}

export function normalizeMailboxSearchQuery(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .replace(CONTROL_CHARACTERS_PATTERN, " ")
    .replace(MULTI_SPACE_PATTERN, " ")
    .trim();
}

export function isMailboxSearchQueryUsable(value: string): boolean {
  return normalizeMailboxSearchQuery(value).length >= 2;
}

export function tokenizeMailboxSearchQuery(value: string): string[] {
  const normalized = normalizeMailboxSearchQuery(value);
  if (!normalized.length) {
    return [];
  }
  const parts = normalized
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  if (parts.length <= 1) {
    return normalized.length ? [normalized] : [];
  }
  return Array.from(new Set(parts))
    .sort((left, right) => right.length - left.length)
    .slice(0, 4);
}

function buildTermSearchFields(term: string): SearchObject[] {
  return [
    { from: term },
    { to: term },
    { cc: term },
    { bcc: term },
    { header: { "Reply-To": term } },
    { subject: term },
    { body: term },
  ];
}

function buildHeaderOnlySearchFields(term: string): SearchObject[] {
  return [
    { from: term },
    { to: term },
    { cc: term },
    { bcc: term },
    { header: { "Reply-To": term } },
    { subject: term },
  ];
}

export function looksLikeMailboxAddressQuery(term: string): boolean {
  return EMAILISH_PATTERN.test(term);
}

export function buildMailboxSearchTermQuery(term: string): SearchObject {
  const normalized = normalizeMailboxSearchQuery(term);
  const searchFields = buildTermSearchFields(normalized);
  if (searchFields.length === 1) {
    return searchFields[0] ?? { subject: normalized };
  }
  return {
    or: searchFields,
  };
}

export function buildMailboxSearchFallbackTermQuery(
  term: string,
): SearchObject {
  const normalized = normalizeMailboxSearchQuery(term);
  const searchFields = looksLikeMailboxAddressQuery(normalized)
    ? buildHeaderOnlySearchFields(normalized)
    : [
        ...buildHeaderOnlySearchFields(normalized),
        { body: normalized },
      ];
  if (searchFields.length === 1) {
    return searchFields[0] ?? { subject: normalized };
  }
  return {
    or: searchFields,
  };
}

export function buildMailboxSearchFieldQueries(
  term: string,
): SearchObject[] {
  const normalized = normalizeMailboxSearchQuery(term);
  if (!normalized.length) {
    return [];
  }

  const queries = buildTermSearchFields(normalized);

  return queries.filter((query) => {
    if ("body" in query) {
      return typeof query.body === "string" && query.body.length > 0;
    }
    if ("subject" in query) {
      return typeof query.subject === "string" && query.subject.length > 0;
    }
    if ("from" in query) {
      return typeof query.from === "string" && query.from.length > 0;
    }
    if ("to" in query) {
      return typeof query.to === "string" && query.to.length > 0;
    }
    if ("cc" in query) {
      return typeof query.cc === "string" && query.cc.length > 0;
    }
    if ("bcc" in query) {
      return typeof query.bcc === "string" && query.bcc.length > 0;
    }
    return true;
  });
}
