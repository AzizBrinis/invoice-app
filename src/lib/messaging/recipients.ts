export type RecipientDraft = {
  display: string;
  address: string;
};

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeRecipient(recipient: RecipientDraft): RecipientDraft {
  const address = recipient.address.trim();
  const display = (recipient.display || "").trim() || address;
  return {
    display,
    address,
  };
}

export function parseRecipientHeader(value: string): RecipientDraft {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      display: "",
      address: "",
    };
  }

  const angleMatch = trimmed.match(/^(.*)<([^<>]+)>$/);
  if (angleMatch) {
    const namePart = stripQuotes(angleMatch[1] ?? "");
    const address = (angleMatch[2] ?? "").trim();
    return normalizeRecipient({
      display: namePart,
      address,
    });
  }

  const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch) {
    const address = emailMatch[0].trim();
    const namePart = stripQuotes(trimmed.slice(0, emailMatch.index).trim());
    return normalizeRecipient({
      display: namePart,
      address,
    });
  }

  const cleaned = stripQuotes(trimmed);
  return normalizeRecipient({
    display: cleaned,
    address: cleaned,
  });
}

export function parseRecipientHeaders(
  values: Iterable<string> | null | undefined,
): RecipientDraft[] {
  if (!values) {
    return [];
  }

  const recipients: RecipientDraft[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") {
      continue;
    }
    const parsed = normalizeRecipient(parseRecipientHeader(raw));
    recipients.push(parsed);
  }
  return recipients;
}

export function splitRecipientInput(value: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function formatRecipientDisplay(
  recipients: RecipientDraft[] | null | undefined,
): string {
  return (recipients ?? [])
    .map((recipient) => recipient.display.trim() || recipient.address.trim())
    .filter((entry) => entry.length > 0)
    .join(", ");
}

export function formatRecipientAddresses(
  recipients: RecipientDraft[] | null | undefined,
): string {
  return (recipients ?? [])
    .map((recipient) => recipient.address.trim())
    .filter((entry) => entry.length > 0)
    .join(", ");
}

export function mergeRecipientLists(
  base: RecipientDraft[],
  additions: RecipientDraft[],
): RecipientDraft[] {
  const result: RecipientDraft[] = [];
  const seen = new Set<string>();

  const register = (recipient: RecipientDraft) => {
    const display = recipient.display.trim();
    const address = recipient.address.trim();
    const key = address.toLowerCase() || display.toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push({
      display: display || address,
      address: address || display,
    });
  };

  base.forEach(register);
  additions.forEach(register);

  return result;
}
