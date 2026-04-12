import { ClientSource, Prisma } from "@/lib/db/prisma-server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  clientSchema,
  getClientTenantId,
  type ClientInput,
} from "@/server/clients";

const MAX_CLIENT_IMPORT_ROWS = 1000;
const MAX_CLIENT_IMPORT_FILE_ISSUES = 12;

const CLIENT_IMPORT_ACTIVE_VALUES = new Set([
  "1",
  "true",
  "yes",
  "oui",
  "actif",
  "active",
  "enabled",
]);

const CLIENT_IMPORT_INACTIVE_VALUES = new Set([
  "0",
  "false",
  "no",
  "non",
  "inactif",
  "inactive",
  "disabled",
]);

const CLIENT_IMPORT_FIELD_ALIASES = {
  displayName: [
    "nom",
    "name",
    "client",
    "displayname",
    "nomraisonsociale",
    "nomclient",
    "clientname",
  ],
  companyName: [
    "societe",
    "company",
    "companyname",
    "raisonsocialesecondaire",
    "secondarycompanyname",
  ],
  email: ["email", "courriel", "mail"],
  phone: ["telephone", "phone", "tel", "mobile", "gsm"],
  vatNumber: [
    "tva",
    "vat",
    "vatnumber",
    "numerotva",
    "matriculefiscal",
    "fiscalid",
  ],
  address: ["adresse", "address"],
  notes: ["notes", "note", "commentaire", "commentaires", "observations"],
  isActive: ["statut", "status", "actif", "active", "isactive", "etat"],
} as const;

type ClientImportField = keyof typeof CLIENT_IMPORT_FIELD_ALIASES;

type ExistingImportClient = {
  id: string;
  displayName: string;
  companyName: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  notes: string | null;
  isActive: boolean;
  source: ClientSource;
  leadMetadata: Prisma.JsonValue | null;
};

type ParsedClientImportRow = {
  rowNumber: number;
  data: ClientInput;
  providedFields: {
    companyName: boolean;
    address: boolean;
    email: boolean;
    phone: boolean;
    vatNumber: boolean;
    notes: boolean;
    isActive: boolean;
  };
  duplicateKey: string;
  matchKeys: {
    email: string | null;
    vatNumber: string | null;
    displayName: string;
    nameCompany: string | null;
    namePhone: string | null;
    nameCompanyPhone: string | null;
  };
};

type ParsedClientImportRows = {
  rows: ParsedClientImportRow[];
  totalRows: number;
  duplicateCount: number;
  validationErrorCount: number;
  issues: ClientImportIssue[];
  remainingIssueCount: number;
};

type IndexedClients = {
  byEmail: Map<string, ExistingImportClient[]>;
  byVatNumber: Map<string, ExistingImportClient[]>;
  byDisplayName: Map<string, ExistingImportClient[]>;
  byNameCompany: Map<string, ExistingImportClient[]>;
  byNamePhone: Map<string, ExistingImportClient[]>;
  byNameCompanyPhone: Map<string, ExistingImportClient[]>;
};

export type ClientImportIssue = {
  rowNumber: number;
  message: string;
};

export type ClientImportSummary = {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  duplicateCount: number;
  validationErrorCount: number;
  issues: ClientImportIssue[];
  remainingIssueCount: number;
};

function normalizeLeadMetadata(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function resolveImportTenantId(providedTenantId?: string) {
  if (providedTenantId) {
    return providedTenantId;
  }

  const user = await requireUser();
  return getClientTenantId(user);
}

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeComparableText(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizePhoneForMatching(value: string | null | undefined) {
  const digits = value?.replace(/[^\d]/g, "") ?? "";
  return digits.length > 0 ? digits : null;
}

function normalizeIdentifier(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeOptionalImportString(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function detectCsvDelimiter(content: string) {
  const sample = content.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const candidates = [";", ",", "\t"] as const;

  const countForDelimiter = (delimiter: string) => {
    let count = 0;
    let inQuotes = false;

    for (let index = 0; index < sample.length; index += 1) {
      const character = sample[index];
      if (character === '"') {
        if (inQuotes && sample[index + 1] === '"') {
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && character === delimiter) {
        count += 1;
      }
    }

    return count;
  };

  let bestDelimiter = ";";
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = countForDelimiter(candidate);
    if (score > bestScore) {
      bestDelimiter = candidate;
      bestScore = score;
    }
  }

  return bestDelimiter;
}

function parseCsvContent(content: string, delimiter: string) {
  const rows: string[][] = [];
  const source = content.replace(/^\uFEFF/, "");
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character === "\r") {
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new Error("CSV invalide : guillemets non fermes.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

function buildHeaderIndexMap(headers: string[]) {
  const headerIndexMap = new Map<ClientImportField, number>();

  (
    Object.entries(CLIENT_IMPORT_FIELD_ALIASES) as Array<
      [ClientImportField, readonly string[]]
    >
  ).forEach(([field, aliases]) => {
    const headerIndex = headers.findIndex((header) =>
      aliases.includes(normalizeCsvHeader(header)),
    );
    if (headerIndex >= 0) {
      headerIndexMap.set(field, headerIndex);
    }
  });

  return headerIndexMap;
}

function createIssueCollector(
  initialIssues: ClientImportIssue[] = [],
  initialHiddenCount = 0,
) {
  const issues = [...initialIssues];
  let hiddenCount = initialHiddenCount;

  return {
    add(issue: ClientImportIssue) {
      if (issues.length < MAX_CLIENT_IMPORT_FILE_ISSUES) {
        issues.push(issue);
      } else {
        hiddenCount += 1;
      }
    },
    toSummary() {
      return {
        issues,
        remainingIssueCount: hiddenCount,
      };
    },
  };
}

function parseClientImportStatus(rawValue: string | null) {
  if (rawValue === null) {
    return {
      value: true,
      provided: false,
      error: null,
    };
  }

  const normalized = normalizeComparableText(rawValue);
  if (!normalized) {
    return {
      value: true,
      provided: false,
      error: null,
    };
  }

  if (CLIENT_IMPORT_ACTIVE_VALUES.has(normalized)) {
    return {
      value: true,
      provided: true,
      error: null,
    };
  }

  if (CLIENT_IMPORT_INACTIVE_VALUES.has(normalized)) {
    return {
      value: false,
      provided: true,
      error: null,
    };
  }

  return {
    value: true,
    provided: true,
    error: "statut invalide (utilisez Actif/Inactif)",
  };
}

function getLeadMetadataRecord(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function buildClientMatchKeys(input: {
  displayName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
}) {
  const displayName = normalizeComparableText(input.displayName) ?? "";
  const companyName = normalizeComparableText(input.companyName);
  const phone = normalizePhoneForMatching(input.phone);
  const email = normalizeComparableText(input.email);
  const vatNumber = normalizeIdentifier(input.vatNumber);

  return {
    email,
    vatNumber,
    displayName,
    nameCompany:
      displayName && companyName ? `${displayName}::${companyName}` : null,
    namePhone: displayName && phone ? `${displayName}::${phone}` : null,
    nameCompanyPhone:
      displayName && companyName && phone
        ? `${displayName}::${companyName}::${phone}`
        : null,
  };
}

function buildFileDuplicateKey(keys: ParsedClientImportRow["matchKeys"]) {
  if (keys.email) {
    return `email:${keys.email}`;
  }
  if (keys.vatNumber) {
    return `vat:${keys.vatNumber}`;
  }
  if (keys.nameCompanyPhone) {
    return `identity:${keys.nameCompanyPhone}`;
  }
  if (keys.namePhone) {
    return `phone:${keys.namePhone}`;
  }
  if (keys.nameCompany) {
    return `company:${keys.nameCompany}`;
  }
  return `name:${keys.displayName}`;
}

function indexClient(
  index: Map<string, ExistingImportClient[]>,
  key: string | null,
  client: ExistingImportClient,
) {
  if (!key) {
    return;
  }

  const existing = index.get(key);
  if (existing) {
    existing.push(client);
    return;
  }

  index.set(key, [client]);
}

function removeClientFromIndex(
  index: Map<string, ExistingImportClient[]>,
  key: string | null,
  clientId: string,
) {
  if (!key) {
    return;
  }

  const next = (index.get(key) ?? []).filter((client) => client.id !== clientId);
  if (next.length > 0) {
    index.set(key, next);
    return;
  }

  index.delete(key);
}

function buildExistingClientIndexes(existingClients: ExistingImportClient[]) {
  const indexes: IndexedClients = {
    byEmail: new Map(),
    byVatNumber: new Map(),
    byDisplayName: new Map(),
    byNameCompany: new Map(),
    byNamePhone: new Map(),
    byNameCompanyPhone: new Map(),
  };

  existingClients.forEach((client) => {
    const keys = buildClientMatchKeys(client);
    indexClient(indexes.byEmail, keys.email, client);
    indexClient(indexes.byVatNumber, keys.vatNumber, client);
    indexClient(indexes.byDisplayName, keys.displayName, client);
    indexClient(indexes.byNameCompany, keys.nameCompany, client);
    indexClient(indexes.byNamePhone, keys.namePhone, client);
    indexClient(indexes.byNameCompanyPhone, keys.nameCompanyPhone, client);
  });

  return indexes;
}

function updateIndexedClient(
  indexes: IndexedClients,
  previous: ExistingImportClient,
  next: ExistingImportClient,
) {
  const previousKeys = buildClientMatchKeys(previous);
  removeClientFromIndex(indexes.byEmail, previousKeys.email, previous.id);
  removeClientFromIndex(indexes.byVatNumber, previousKeys.vatNumber, previous.id);
  removeClientFromIndex(
    indexes.byDisplayName,
    previousKeys.displayName,
    previous.id,
  );
  removeClientFromIndex(
    indexes.byNameCompany,
    previousKeys.nameCompany,
    previous.id,
  );
  removeClientFromIndex(indexes.byNamePhone, previousKeys.namePhone, previous.id);
  removeClientFromIndex(
    indexes.byNameCompanyPhone,
    previousKeys.nameCompanyPhone,
    previous.id,
  );

  const nextKeys = buildClientMatchKeys(next);
  indexClient(indexes.byEmail, nextKeys.email, next);
  indexClient(indexes.byVatNumber, nextKeys.vatNumber, next);
  indexClient(indexes.byDisplayName, nextKeys.displayName, next);
  indexClient(indexes.byNameCompany, nextKeys.nameCompany, next);
  indexClient(indexes.byNamePhone, nextKeys.namePhone, next);
  indexClient(indexes.byNameCompanyPhone, nextKeys.nameCompanyPhone, next);
}

function buildUpdatedClientInput(
  existing: ExistingImportClient,
  row: ParsedClientImportRow,
) {
  return clientSchema.parse({
    displayName: row.data.displayName,
    companyName: row.providedFields.companyName
      ? row.data.companyName ?? null
      : existing.companyName,
    address: row.providedFields.address
      ? row.data.address ?? null
      : existing.address,
    email: row.providedFields.email
      ? row.data.email ?? null
      : existing.email,
    phone: row.providedFields.phone
      ? row.data.phone ?? null
      : existing.phone,
    vatNumber: row.providedFields.vatNumber
      ? row.data.vatNumber ?? null
      : existing.vatNumber,
    notes: row.providedFields.notes
      ? row.data.notes ?? null
      : existing.notes,
    isActive: row.providedFields.isActive
      ? row.data.isActive
      : existing.isActive,
    source: existing.source,
    leadMetadata: getLeadMetadataRecord(existing.leadMetadata),
  });
}

function resolveClientImportMatch(
  row: ParsedClientImportRow,
  indexes: IndexedClients,
) {
  const singleMatch = (candidates: ExistingImportClient[] | undefined) =>
    candidates && candidates.length === 1 ? candidates[0] : null;
  const multipleMatches = (candidates: ExistingImportClient[] | undefined) =>
    Boolean(candidates && candidates.length > 1);

  if (row.matchKeys.email) {
    const candidates = indexes.byEmail.get(row.matchKeys.email);
    if (multipleMatches(candidates)) {
      return {
        status: "skip" as const,
        message: "plusieurs clients existants partagent cet e-mail",
        duplicate: true,
      };
    }
    const matched = singleMatch(candidates);
    if (matched) {
      return { status: "update" as const, client: matched };
    }
  }

  if (row.matchKeys.vatNumber) {
    const candidates = indexes.byVatNumber.get(row.matchKeys.vatNumber);
    if (multipleMatches(candidates)) {
      return {
        status: "skip" as const,
        message: "plusieurs clients existants partagent cette TVA",
        duplicate: true,
      };
    }
    const matched = singleMatch(candidates);
    if (matched) {
      return { status: "update" as const, client: matched };
    }
  }

  if (row.matchKeys.nameCompanyPhone) {
    const matched = singleMatch(
      indexes.byNameCompanyPhone.get(row.matchKeys.nameCompanyPhone),
    );
    if (matched) {
      return { status: "update" as const, client: matched };
    }
  }

  if (row.matchKeys.namePhone) {
    const candidates = indexes.byNamePhone.get(row.matchKeys.namePhone);
    if (multipleMatches(candidates)) {
      return {
        status: "skip" as const,
        message: "plusieurs clients existants partagent ce nom et telephone",
        duplicate: true,
      };
    }
    const matched = singleMatch(candidates);
    if (matched) {
      return { status: "update" as const, client: matched };
    }
  }

  if (row.matchKeys.nameCompany) {
    const candidates = indexes.byNameCompany.get(row.matchKeys.nameCompany);
    if (multipleMatches(candidates)) {
      return {
        status: "skip" as const,
        message: "plusieurs clients existants partagent ce nom et cette societe",
        duplicate: true,
      };
    }
    const matched = singleMatch(candidates);
    if (matched) {
      return { status: "update" as const, client: matched };
    }
  }

  const nameMatches = indexes.byDisplayName.get(row.matchKeys.displayName);
  if (nameMatches && nameMatches.length > 0) {
    return {
      status: "skip" as const,
      message:
        "client potentiellement deja present (ajoutez un e-mail, telephone ou numero TVA pour lever l'ambiguite)",
      duplicate: true,
    };
  }

  return { status: "create" as const };
}

function parseClientImportRows(content: string): ParsedClientImportRows {
  const delimiter = detectCsvDelimiter(content);
  const rows = parseCsvContent(content, delimiter);

  if (rows.length < 2) {
    throw new Error("CSV vide ou incomplet.");
  }

  const headerIndexMap = buildHeaderIndexMap(rows[0] ?? []);
  if (!headerIndexMap.has("displayName")) {
    throw new Error("La colonne Nom est requise.");
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CLIENT_IMPORT_ROWS) {
    throw new Error(
      `Le fichier depasse la limite de ${MAX_CLIENT_IMPORT_ROWS} lignes.`,
    );
  }

  const collector = createIssueCollector();
  const parsedRows: ParsedClientImportRow[] = [];
  let duplicateCount = 0;
  let validationErrorCount = 0;

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const getValue = (field: ClientImportField) => {
      const headerIndex = headerIndexMap.get(field);
      if (headerIndex === undefined) {
        return null;
      }
      return row[headerIndex]?.trim() ?? "";
    };

    const displayName = normalizeOptionalImportString(getValue("displayName"));
    const companyName = normalizeOptionalImportString(getValue("companyName"));
    const address = normalizeOptionalImportString(getValue("address"));
    const email =
      normalizeOptionalImportString(getValue("email"))?.toLowerCase() ?? null;
    const phone = normalizeOptionalImportString(getValue("phone"));
    const vatNumber = normalizeOptionalImportString(getValue("vatNumber"));
    const notes = normalizeOptionalImportString(getValue("notes"));
    const statusResult = parseClientImportStatus(getValue("isActive"));

    if (!displayName) {
      validationErrorCount += 1;
      collector.add({
        rowNumber,
        message: "nom manquant",
      });
      return;
    }

    if (statusResult.error) {
      validationErrorCount += 1;
      collector.add({
        rowNumber,
        message: statusResult.error,
      });
      return;
    }

    const parsed = clientSchema.safeParse({
      displayName,
      companyName,
      address,
      email,
      phone,
      vatNumber,
      notes,
      isActive: statusResult.value,
      source: ClientSource.IMPORT,
    });

    if (!parsed.success) {
      validationErrorCount += 1;
      collector.add({
        rowNumber,
        message: parsed.error.issues[0]?.message ?? "ligne invalide",
      });
      return;
    }

    const matchKeys = buildClientMatchKeys({
      displayName: parsed.data.displayName,
      companyName: parsed.data.companyName ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      vatNumber: parsed.data.vatNumber ?? null,
    });

    if (!matchKeys.displayName) {
      validationErrorCount += 1;
      collector.add({
        rowNumber,
        message: "nom invalide",
      });
      return;
    }

    parsedRows.push({
      rowNumber,
      data: parsed.data,
      providedFields: {
        companyName: companyName !== null,
        address: address !== null,
        email: email !== null,
        phone: phone !== null,
        vatNumber: vatNumber !== null,
        notes: notes !== null,
        isActive: statusResult.provided,
      },
      duplicateKey: buildFileDuplicateKey(matchKeys),
      matchKeys,
    });
  });

  const seenKeys = new Set<string>();
  const deduplicatedRows: ParsedClientImportRow[] = [];

  parsedRows.forEach((row) => {
    if (seenKeys.has(row.duplicateKey)) {
      duplicateCount += 1;
      collector.add({
        rowNumber: row.rowNumber,
        message: "ligne dupliquee dans le fichier",
      });
      return;
    }

    seenKeys.add(row.duplicateKey);
    deduplicatedRows.push(row);
  });

  const summary = collector.toSummary();
  return {
    rows: deduplicatedRows,
    totalRows: dataRows.length,
    duplicateCount,
    validationErrorCount,
    issues: summary.issues,
    remainingIssueCount: summary.remainingIssueCount,
  };
}

export async function importClientsFromCsv(
  content: string,
  userId?: string,
): Promise<ClientImportSummary> {
  const resolvedUserId = await resolveImportTenantId(userId);
  const parsed = parseClientImportRows(content);

  if (parsed.rows.length === 0) {
    return {
      totalRows: parsed.totalRows,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: parsed.totalRows,
      duplicateCount: parsed.duplicateCount,
      validationErrorCount: parsed.validationErrorCount,
      issues: parsed.issues,
      remainingIssueCount: parsed.remainingIssueCount,
    };
  }

  const existingClients = await prisma.client.findMany({
    where: { userId: resolvedUserId },
    select: {
      id: true,
      displayName: true,
      companyName: true,
      address: true,
      email: true,
      phone: true,
      vatNumber: true,
      notes: true,
      isActive: true,
      source: true,
      leadMetadata: true,
    },
  });
  const indexes = buildExistingClientIndexes(existingClients);
  const collector = createIssueCollector(
    parsed.issues,
    parsed.remainingIssueCount,
  );

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = parsed.totalRows - parsed.rows.length;
  let duplicateCount = parsed.duplicateCount;
  let validationErrorCount = parsed.validationErrorCount;

  for (const row of parsed.rows) {
    const match = resolveClientImportMatch(row, indexes);

    if (match.status === "skip") {
      skippedCount += 1;
      if (match.duplicate) {
        duplicateCount += 1;
      } else {
        validationErrorCount += 1;
      }
      collector.add({
        rowNumber: row.rowNumber,
        message: match.message,
      });
      continue;
    }

    if (match.status === "update") {
      const payload = buildUpdatedClientInput(match.client, row);
      const { id: _id, ...data } = payload;
      void _id;
      const { leadMetadata, ...rest } = data;
      const updated = await prisma.client.update({
        where: { id: match.client.id },
        data: {
          ...rest,
          userId: resolvedUserId,
          leadMetadata: normalizeLeadMetadata(leadMetadata),
        },
        select: {
          id: true,
          displayName: true,
          companyName: true,
          address: true,
          email: true,
          phone: true,
          vatNumber: true,
          notes: true,
          isActive: true,
          source: true,
          leadMetadata: true,
        },
      });

      const existingIndex = existingClients.findIndex(
        (client) => client.id === updated.id,
      );
      if (existingIndex >= 0) {
        updateIndexedClient(indexes, existingClients[existingIndex], updated);
        existingClients[existingIndex] = updated;
      }

      updatedCount += 1;
      continue;
    }

    const payload = clientSchema.parse({
      ...row.data,
      source: ClientSource.IMPORT,
    });
    const { id: _id, ...data } = payload;
    void _id;
    const { leadMetadata, ...rest } = data;
    const created = await prisma.client.create({
      data: {
        userId: resolvedUserId,
        ...rest,
        leadMetadata: normalizeLeadMetadata(leadMetadata),
      },
      select: {
        id: true,
        displayName: true,
        companyName: true,
        address: true,
        email: true,
        phone: true,
        vatNumber: true,
        notes: true,
        isActive: true,
        source: true,
        leadMetadata: true,
      },
    });

    existingClients.push(created);
    updateIndexedClient(indexes, created, created);
    createdCount += 1;
  }

  const summary = collector.toSummary();
  return {
    totalRows: parsed.totalRows,
    createdCount,
    updatedCount,
    skippedCount,
    duplicateCount,
    validationErrorCount,
    issues: summary.issues,
    remainingIssueCount: summary.remainingIssueCount,
  };
}
