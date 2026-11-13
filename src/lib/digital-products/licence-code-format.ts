/**
 * Kaspersky activation-code format helpers. Pure functions shared by the
 * client (input formatting) and the server (validation, import parsing).
 *
 * Format: 20 characters A–Z / 0–9, displayed as XXXXX-XXXXX-XXXXX-XXXXX.
 */

export const LICENCE_CODE_LENGTH = 20;
const GROUP_SIZE = 5;
const CODE_PATTERN = /^[A-Z0-9]{20}$/;

/** Uppercases and strips separators (spaces, dashes, dots, underscores). */
export function normalizeLicenceCode(value: string): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[\s\-_.‐-―]/g, "");
}

export function isValidLicenceCode(normalized: string): boolean {
  return CODE_PATTERN.test(normalized);
}

export function formatLicenceCode(normalized: string): string {
  const clean = normalized.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, LICENCE_CODE_LENGTH);
  return (clean.match(new RegExp(`.{1,${GROUP_SIZE}}`, "g")) ?? []).join("-");
}

/** Last 4 characters, stored in clear for masked display. */
export function licenceCodeHint(normalized: string): string {
  return normalized.slice(-4);
}

/** "•••••-•••••-•••••-•ABCD" */
export function maskLicenceCode(hint: string): string {
  const visible = String(hint ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(-4)
    .padStart(4, "•");
  return `•••••-•••••-•••••-•${visible}`;
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
export function parseLicenceCodeInput(text: string): ParsedCodeInput {
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
    const code = cells.map(normalizeLicenceCode).find(isValidLicenceCode);
    if (!code) {
      const looksLikeHeader = index === 0 && /code|licen|activation|cl[eé]/i.test(trimmed);
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
