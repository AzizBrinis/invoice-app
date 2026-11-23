/**
 * Activation-code format helpers. Pure functions shared by the client (input
 * formatting) and the server (validation, import parsing).
 *
 * Each product family has its own format:
 *   - Kaspersky: 20 characters A–Z / 0–9, displayed as XXXXX-XXXXX-XXXXX-XXXXX
 *   - Windows:   25 characters A–Z / 0–9, displayed as XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
 *   - IDM:       20 characters A–Z / 0–9, displayed as XXXXX-XXXXX-XXXXX-XXXXX
 *
 * Every helper defaults to the Kaspersky format, which keeps the historical
 * single-product call sites unchanged.
 */

export type LicenceCodeFormat = {
  id: "kaspersky" | "windows" | "idm";
  length: number;
  groupSize: number;
  /** "XXXXX-XXXXX-…" */
  placeholder: string;
  /**
   * Codes that look valid but must never enter the stock, e.g. Microsoft's
   * public generic (non-activating) edition-upgrade keys.
   */
  rejected: readonly string[];
};

function placeholderFor(length: number, groupSize: number) {
  return Array.from({ length: Math.ceil(length / groupSize) }, () => "X".repeat(groupSize)).join("-");
}

export const KASPERSKY_CODE_FORMAT: LicenceCodeFormat = Object.freeze({
  id: "kaspersky",
  length: 20,
  groupSize: 5,
  placeholder: placeholderFor(20, 5),
  rejected: Object.freeze([]) as readonly string[],
});

/**
 * Public generic keys published by Microsoft for Windows 11 Pro: they only
 * switch the edition and never activate Windows. Selling one would deliver a
 * worthless code, so they are refused at import.
 */
export const WINDOWS_GENERIC_KEYS = Object.freeze([
  "VK7JGNPHTMC97JM9MPGT3V66T", // Windows 11 Pro (edition upgrade)
  "W269NWFGWXYVC9B4J6C9T83GX", // Windows 11 Pro (KMS client)
]) as readonly string[];

export const WINDOWS_CODE_FORMAT: LicenceCodeFormat = Object.freeze({
  id: "windows",
  length: 25,
  groupSize: 5,
  placeholder: placeholderFor(25, 5),
  rejected: WINDOWS_GENERIC_KEYS,
});

/**
 * Internet Download Manager serial numbers: same shape as Kaspersky codes but
 * a distinct format so each family keeps its own validation rules.
 */
export const IDM_CODE_FORMAT: LicenceCodeFormat = Object.freeze({
  id: "idm",
  length: 20,
  groupSize: 5,
  placeholder: placeholderFor(20, 5),
  rejected: Object.freeze([]) as readonly string[],
});

/** Kaspersky length, kept for existing imports. */
export const LICENCE_CODE_LENGTH = KASPERSKY_CODE_FORMAT.length;

/** Uppercases and strips separators (spaces, dashes, dots, underscores). */
export function normalizeLicenceCode(value: string): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[\s\-_.‐-―]/g, "");
}

export function isValidLicenceCode(
  normalized: string,
  format: LicenceCodeFormat = KASPERSKY_CODE_FORMAT,
): boolean {
  return (
    normalized.length === format.length &&
    /^[A-Z0-9]+$/.test(normalized) &&
    !format.rejected.includes(normalized)
  );
}

export function formatLicenceCode(
  normalized: string,
  format: LicenceCodeFormat = KASPERSKY_CODE_FORMAT,
): string {
  const clean = String(normalized ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, format.length);
  return (clean.match(new RegExp(`.{1,${format.groupSize}}`, "g")) ?? []).join("-");
}

/** Last 4 characters, stored in clear for masked display. */
export function licenceCodeHint(normalized: string): string {
  return normalized.slice(-4);
}

/** "•••••-•••••-•••••-•ABCD" (Kaspersky) / "•••••-•••••-•••••-•••••-•ABCD" (Windows) */
export function maskLicenceCode(hint: string, format: LicenceCodeFormat = KASPERSKY_CODE_FORMAT): string {
  const visible = String(hint ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(-4)
    .padStart(4, "•");
  const hidden = "•".repeat(format.length - 4) + visible;
  return (hidden.match(new RegExp(`.{1,${format.groupSize}}`, "g")) ?? []).join("-");
}

export type ParsedCodeLine = {
  line: number;
  code: string;
};

export type ParsedCodeInput = {
  valid: ParsedCodeLine[];
  /** Line numbers whose content is not a valid code (content never echoed). */
  invalidLines: number[];
  /** Line numbers repeating a code already present earlier in the same input. */
  duplicateLines: number[];
};

const MAX_IMPORT_LINES = 5000;

export class LicenceImportTooLargeError extends Error {
  constructor() {
    super(`Import limité à ${MAX_IMPORT_LINES} codes par envoi.`);
    this.name = "LicenceImportTooLargeError";
  }
}

/**
 * Parses free-form bulk input: one code per line; CSV/TSV lines are accepted
 * and the first cell that looks like a code is used. A header row is skipped.
 */
export function parseLicenceCodeInput(
  text: string,
  format: LicenceCodeFormat = KASPERSKY_CODE_FORMAT,
): ParsedCodeInput {
  const lines = String(text ?? "").split(/\r\n|\r|\n/);
  const nonEmpty = lines.filter((line) => line.trim()).length;
  if (nonEmpty > MAX_IMPORT_LINES) {
    throw new LicenceImportTooLargeError();
  }
  const seen = new Set<string>();
  const result: ParsedCodeInput = { valid: [], invalidLines: [], duplicateLines: [] };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim().replace(/^﻿/, "");
    if (!trimmed) return;
    const cells = trimmed.split(/[,;\t|]/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const code = cells.map(normalizeLicenceCode).find((cell) => isValidLicenceCode(cell, format));
    if (!code) {
      const looksLikeHeader = index === 0 && /code|licen|activation|cl[eé]|s[eé]ri[ae]l?/i.test(trimmed);
      if (!looksLikeHeader) result.invalidLines.push(lineNumber);
      return;
    }
    if (seen.has(code)) {
      result.duplicateLines.push(lineNumber);
      return;
    }
    seen.add(code);
    result.valid.push({ line: lineNumber, code });
  });

  return result;
}
