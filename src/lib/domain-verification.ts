import { Resolver } from "dns/promises";

const resolver = new Resolver();
const VERIFICATION_PREFIX = "verification=";
const VERIFICATION_HOST_PREFIX = "_verification.";

export type DomainRecordCheckOptions = {
  domain: string;
  verificationCode: string;
  cnameTarget: string;
};

export type DomainVerificationErrorCode =
  | "TXT_NOT_FOUND"
  | "TXT_MISMATCH"
  | "TXT_LOOKUP_FAILED"
  | "CNAME_NOT_FOUND"
  | "CNAME_MISMATCH"
  | "CNAME_LOOKUP_FAILED";

type DomainVerificationErrorOptions = {
  cause?: unknown;
};

export class DomainVerificationError extends Error {
  readonly code: DomainVerificationErrorCode;

  constructor(
    code: DomainVerificationErrorCode,
    message: string,
    options?: DomainVerificationErrorOptions,
  ) {
    super(message);
    this.name = "DomainVerificationError";
    this.code = code;
    if (options?.cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }
  }
}

function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.+$/, "")
    .toLowerCase();
}

function flattenTxtRecords(records: string[][]): string[] {
  return records.map((entry) => entry.join("").trim()).filter(Boolean);
}

function isDnsNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "ENOTFOUND" || code === "ENODATA";
}

async function readTxtRecords(host: string) {
  try {
    const records = await resolver.resolveTxt(host);
    return {
      host,
      values: flattenTxtRecords(records),
    };
  } catch (error) {
    if (isDnsNotFound(error)) {
      return null;
    }
    throw new DomainVerificationError(
      "TXT_LOOKUP_FAILED",
      `Impossible de lire les enregistrements TXT de ${host}. Patientez quelques minutes et réessayez.`,
      { cause: error },
    );
  }
}

function extractVerificationEntries(values: string[]) {
  return values.filter((value) =>
    value.toLowerCase().startsWith(VERIFICATION_PREFIX),
  );
}

async function assertTxtRecord(domain: string, expectedCode: string) {
  const verificationHost = `${VERIFICATION_HOST_PREFIX}${domain}`;
  const candidates = [verificationHost, domain];
  let mismatch: { host: string; values: string[] } | null = null;

  for (const host of candidates) {
    const result = await readTxtRecords(host);
    if (!result) {
      continue;
    }
    const entries = extractVerificationEntries(result.values);
    if (!entries.length) {
      continue;
    }
    const match = entries.find(
      (value) => value.slice(VERIFICATION_PREFIX.length) === expectedCode,
    );
    if (match) {
      return;
    }
    mismatch = { host, values: entries };
  }

  if (mismatch) {
    const values = mismatch.values
      .map((value) => value.slice(VERIFICATION_PREFIX.length))
      .join(", ");
    throw new DomainVerificationError(
      "TXT_MISMATCH",
      `Le TXT sur ${mismatch.host} contient verification=${values}, attendez verification=${expectedCode}.`,
    );
  }

  throw new DomainVerificationError(
    "TXT_NOT_FOUND",
    `Ajoutez un TXT verification=${expectedCode} sur ${verificationHost} (le sous-domaine _verification évite le conflit avec le CNAME).`,
  );
}

async function assertCnameRecord(domain: string, cnameTarget: string) {
  let records: string[];
  try {
    records = await resolver.resolveCname(domain);
  } catch (error) {
    if (isDnsNotFound(error)) {
      throw new DomainVerificationError(
        "CNAME_NOT_FOUND",
        `Aucun CNAME n’est configuré pour ${domain}. Pointez le domaine vers ${cnameTarget} puis relancez la vérification.`,
      );
    }
    throw new DomainVerificationError(
      "CNAME_LOOKUP_FAILED",
      `Impossible d’interroger le CNAME de ${domain}. Patientez quelques minutes puis réessayez.`,
      { cause: error },
    );
  }

  const normalizedTarget = normalizeHost(cnameTarget);
  const normalizedRecords = records.map((value) => normalizeHost(value));
  if (!normalizedRecords.includes(normalizedTarget)) {
    const currentValue = normalizedRecords.length
      ? normalizedRecords.join(", ")
      : "aucune cible";
    throw new DomainVerificationError(
      "CNAME_MISMATCH",
      `Le CNAME de ${domain} doit pointer vers ${normalizedTarget}. Valeur actuelle : ${currentValue}.`,
    );
  }
}

export async function assertCustomDomainRecords(
  options: DomainRecordCheckOptions,
) {
  await assertTxtRecord(options.domain, options.verificationCode);
  await assertCnameRecord(options.domain, options.cnameTarget);
}
