import { fr as chronoFr, type ParsedComponents, type ParsedResult } from "chrono-node";
import { fromZonedTime } from "date-fns-tz";
import { normalizeTimezone, DEFAULT_TIMEZONE } from "@/lib/timezone";

const chronoParser = chronoFr.casual;

const HALF_HOUR_PATTERNS: ReadonlyArray<RegExp> = [
  /\bune demi[-\s]?heure\b/gi,
  /\bdemi[-\s]?heure\b/gi,
  /\b1\/2 ?heure\b/gi,
];

type ParseOptions = {
  text: string;
  timezone?: string | null;
  referenceDate?: Date;
};

export type ScheduledSendTime = {
  sendAt: Date;
  matchedText: string;
};

export function parseRequestedSendTime(
  options: ParseOptions,
): ScheduledSendTime | null {
  const timezone = normalizeTimezone(options.timezone);
  const referenceDate = options.referenceDate ?? new Date();
  const sanitizedText = normalizeScheduleText(options.text);
  if (!sanitizedText) {
    return null;
  }
  const parsed = chronoParser.parse(sanitizedText, referenceDate, {
    forwardDate: true,
  });
  if (!parsed.length) {
    return null;
  }
  const viable = parsed
    .map((entry) => ({
      entry,
      sendAt: convertComponentsToDate(entry.start, entry, timezone),
    }))
    .filter(({ sendAt }) => sendAt.getTime() > referenceDate.getTime());
  if (!viable.length) {
    return null;
  }
  viable.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
  const best = viable[0]!;
  return {
    sendAt: best.sendAt,
    matchedText: best.entry.text,
  };
}

export function formatScheduledTime(
  sendAt: Date,
  timezone?: string | null,
  locale = "fr-FR",
): string {
  const resolvedTimezone = timezone
    ? normalizeTimezone(timezone)
    : DEFAULT_TIMEZONE;
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: resolvedTimezone,
    });
    return `${formatter.format(sendAt)} (${resolvedTimezone})`;
  } catch {
    return `${sendAt.toISOString()} (${resolvedTimezone})`;
  }
}

function normalizeScheduleText(text: string): string {
  let normalized = text.trim();
  if (!normalized) {
    return "";
  }
  HALF_HOUR_PATTERNS.forEach((pattern) => {
    normalized = normalized.replace(pattern, "30 minutes");
  });
  return normalized;
}

function convertComponentsToDate(
  components: ParsedComponents,
  parsed: ParsedResult,
  timezone: string,
): Date {
  const ref = parsed.refDate;
  const year = components.get("year") ?? ref.getUTCFullYear();
  const month = components.get("month") ?? ref.getUTCMonth() + 1;
  const day = components.get("day") ?? ref.getUTCDate();
  const hour = components.get("hour") ?? 9;
  const minute = components.get("minute") ?? 0;
  const second = components.get("second") ?? 0;
  const millisecond = components.get("millisecond") ?? 0;

  const localIso = [
    `${year.toString().padStart(4, "0")}`,
    "-",
    `${month.toString().padStart(2, "0")}`,
    "-",
    `${day.toString().padStart(2, "0")}`,
    "T",
    `${hour.toString().padStart(2, "0")}`,
    ":",
    `${minute.toString().padStart(2, "0")}`,
    ":",
    `${second.toString().padStart(2, "0")}`,
    ".",
    `${millisecond.toString().padStart(3, "0")}`,
  ].join("");
  return fromZonedTime(localIso, timezone);
}
