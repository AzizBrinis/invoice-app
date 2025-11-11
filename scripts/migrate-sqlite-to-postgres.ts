import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

const sqliteUrl = process.env.SQLITE_URL ?? "file:./prisma/dev.db";
const sourceUrl = normalizeSqliteUrl(sqliteUrl);
const sqliteFilePath = extractSqlitePath(sourceUrl);
const targetUrl =
  process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";

if (!targetUrl) {
  throw new Error(
    "Set POSTGRES_URL or DATABASE_URL to the Supabase connection string before running the migration script.",
  );
}

const postgres = new PrismaClient({
  datasources: {
    db: { url: targetUrl },
  },
});

function normalizeSqliteUrl(url: string) {
  if (!url.startsWith("file:")) {
    throw new Error(
      `Unsupported SQLite connection string: ${url}. Use the form file:./relative/or/absolute/path.db`,
    );
  }

  const rawPath = url.replace(/^file:/, "");
  const absolutePath = path.resolve(rawPath);

  if (fs.existsSync(absolutePath)) {
    return url;
  }

  const legacySnapshot = path.resolve("prisma/prisma/dev.db");
  if (absolutePath !== legacySnapshot && fs.existsSync(legacySnapshot)) {
    console.warn(
      `SQLite file ${rawPath} not found. Falling back to legacy snapshot at prisma/prisma/dev.db.`,
    );
    const relativeLegacy = path.relative(process.cwd(), legacySnapshot);
    return `file:${relativeLegacy}`;
  }

  throw new Error(
    `SQLite file ${rawPath} not found. Provide SQLITE_URL pointing to an existing SQLite database.`,
  );
}

function extractSqlitePath(url: string) {
  return path.resolve(url.replace(/^file:/, ""));
}

function readSqliteTable(table: string) {
  const query = `SELECT * FROM "${table}"`;

  try {
    const rawResult = execFileSync(
      "sqlite3",
      ["-json", sqliteFilePath, query],
      { encoding: "utf8" },
    ).trim();
    if (!rawResult) {
      return [];
    }
    return JSON.parse(rawResult);
  } catch (error) {
    throw new Error(
      `Failed to read table ${table} from SQLite: ${(error as Error).message}`,
    );
  }
}

function normalizeRows(modelName: string, rows: unknown[]) {
  const dateFields = dateTimeFieldsMap.get(modelName) ?? new Set<string>();
  const booleanFields = booleanFieldsMap.get(modelName) ?? new Set<string>();
  const jsonFields = jsonFieldsMap.get(modelName) ?? new Set<string>();

  return rows.map((row) => {
    const record = { ...(row as Record<string, unknown>) };

    for (const field of dateFields) {
      const value = record[field];
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === "number") {
        record[field] = new Date(value);
        continue;
      }

      if (typeof value === "string" && /^\d+$/.test(value)) {
        const asNumber = Number(value);
        if (!Number.isNaN(asNumber) && asNumber > 1e10) {
          record[field] = new Date(asNumber);
        }
      }
    }

    for (const field of booleanFields) {
      const value = record[field];
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === "number") {
        record[field] = value === 1;
        continue;
      }

      if (typeof value === "string" && (value === "1" || value === "0")) {
        record[field] = value === "1";
      }
    }

    for (const field of jsonFields) {
      const value = record[field];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            record[field] = JSON.parse(trimmed);
          } catch {
            // keep original string if parsing fails
          }
        }
      }
    }

    return record;
  });
}

type CopyOperation = {
  name: string;
  pull: () => Promise<unknown[]>;
  push: (rows: unknown[]) => Promise<number>;
  targetCount: () => Promise<number>;
};

const createMany = (delegate: any) =>
  async (rows: unknown[]) => {
    if (!rows.length) {
      return 0;
    }

    const { count } = await delegate.createMany({
      data: rows as any,
      skipDuplicates: true,
    });
    return count;
  };

const dateTimeFieldsMap = new Map<string, Set<string>>();
const booleanFieldsMap = new Map<string, Set<string>>();
const jsonFieldsMap = new Map<string, Set<string>>();
for (const model of Prisma.dmmf.datamodel.models) {
  const dateFields = model.fields
    .filter((field) => field.type === "DateTime")
    .map((field) => field.name);
  const booleanFields = model.fields
    .filter((field) => field.type === "Boolean")
    .map((field) => field.name);
  const jsonFields = model.fields
    .filter((field) => field.type === "Json")
    .map((field) => field.name);

  dateTimeFieldsMap.set(model.name, new Set(dateFields));
  booleanFieldsMap.set(model.name, new Set(booleanFields));
  jsonFieldsMap.set(model.name, new Set(jsonFields));
}

const pull = (modelName: string) => async () =>
  normalizeRows(modelName, readSqliteTable(modelName));

const copyOperations: CopyOperation[] = [
  {
    name: "User",
    pull: pull("User"),
    push: createMany(postgres.user),
    targetCount: () => postgres.user.count(),
  },
  {
    name: "Session",
    pull: pull("Session"),
    push: createMany(postgres.session),
    targetCount: () => postgres.session.count(),
  },
  {
    name: "PdfTemplate",
    pull: pull("PdfTemplate"),
    push: createMany(postgres.pdfTemplate),
    targetCount: () => postgres.pdfTemplate.count(),
  },
  {
    name: "CompanySettings",
    pull: pull("CompanySettings"),
    push: createMany(postgres.companySettings),
    targetCount: () => postgres.companySettings.count(),
  },
  {
    name: "WebsiteConfig",
    pull: pull("WebsiteConfig"),
    push: createMany(postgres.websiteConfig),
    targetCount: () => postgres.websiteConfig.count(),
  },
  {
    name: "MessagingSettings",
    pull: pull("MessagingSettings"),
    push: createMany(postgres.messagingSettings),
    targetCount: () => postgres.messagingSettings.count(),
  },
  {
    name: "MessagingSavedResponse",
    pull: pull("MessagingSavedResponse"),
    push: createMany(postgres.messagingSavedResponse),
    targetCount: () => postgres.messagingSavedResponse.count(),
  },
  {
    name: "MessagingAutoReplyLog",
    pull: pull("MessagingAutoReplyLog"),
    push: createMany(postgres.messagingAutoReplyLog),
    targetCount: () => postgres.messagingAutoReplyLog.count(),
  },
  {
    name: "MessagingScheduledEmail",
    pull: pull("MessagingScheduledEmail"),
    push: createMany(postgres.messagingScheduledEmail),
    targetCount: () => postgres.messagingScheduledEmail.count(),
  },
  {
    name: "MessagingScheduledAttachment",
    pull: pull("MessagingScheduledAttachment"),
    push: createMany(postgres.messagingScheduledAttachment),
    targetCount: () => postgres.messagingScheduledAttachment.count(),
  },
  {
    name: "MessagingEmail",
    pull: pull("MessagingEmail"),
    push: createMany(postgres.messagingEmail),
    targetCount: () => postgres.messagingEmail.count(),
  },
  {
    name: "MessagingEmailRecipient",
    pull: pull("MessagingEmailRecipient"),
    push: createMany(postgres.messagingEmailRecipient),
    targetCount: () => postgres.messagingEmailRecipient.count(),
  },
  {
    name: "MessagingEmailLink",
    pull: pull("MessagingEmailLink"),
    push: createMany(postgres.messagingEmailLink),
    targetCount: () => postgres.messagingEmailLink.count(),
  },
  {
    name: "MessagingEmailLinkRecipient",
    pull: pull("MessagingEmailLinkRecipient"),
    push: createMany(postgres.messagingEmailLinkRecipient),
    targetCount: () => postgres.messagingEmailLinkRecipient.count(),
  },
  {
    name: "MessagingEmailEvent",
    pull: pull("MessagingEmailEvent"),
    push: createMany(postgres.messagingEmailEvent),
    targetCount: () => postgres.messagingEmailEvent.count(),
  },
  {
    name: "Client",
    pull: pull("Client"),
    push: createMany(postgres.client),
    targetCount: () => postgres.client.count(),
  },
  {
    name: "Product",
    pull: pull("Product"),
    push: createMany(postgres.product),
    targetCount: () => postgres.product.count(),
  },
  {
    name: "NumberingSequence",
    pull: pull("NumberingSequence"),
    push: createMany(postgres.numberingSequence),
    targetCount: () => postgres.numberingSequence.count(),
  },
  {
    name: "Quote",
    pull: pull("Quote"),
    push: createMany(postgres.quote),
    targetCount: () => postgres.quote.count(),
  },
  {
    name: "QuoteLine",
    pull: pull("QuoteLine"),
    push: createMany(postgres.quoteLine),
    targetCount: () => postgres.quoteLine.count(),
  },
  {
    name: "Invoice",
    pull: pull("Invoice"),
    push: createMany(postgres.invoice),
    targetCount: () => postgres.invoice.count(),
  },
  {
    name: "InvoiceLine",
    pull: pull("InvoiceLine"),
    push: createMany(postgres.invoiceLine),
    targetCount: () => postgres.invoiceLine.count(),
  },
  {
    name: "Payment",
    pull: pull("Payment"),
    push: createMany(postgres.payment),
    targetCount: () => postgres.payment.count(),
  },
  {
    name: "InvoiceAuditLog",
    pull: pull("InvoiceAuditLog"),
    push: createMany(postgres.invoiceAuditLog),
    targetCount: () => postgres.invoiceAuditLog.count(),
  },
  {
    name: "EmailLog",
    pull: pull("EmailLog"),
    push: createMany(postgres.emailLog),
    targetCount: () => postgres.emailLog.count(),
  },
  {
    name: "SpamDetectionLog",
    pull: pull("SpamDetectionLog"),
    push: createMany(postgres.spamDetectionLog),
    targetCount: () => postgres.spamDetectionLog.count(),
  },
  {
    name: "SpamSenderReputation",
    pull: pull("SpamSenderReputation"),
    push: createMany(postgres.spamSenderReputation),
    targetCount: () => postgres.spamSenderReputation.count(),
  },
];

const maskConnectionString = (raw: string) => {
  try {
    const parsed = new URL(raw);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return raw;
  }
};

async function ensureTargetIsEmpty() {
  for (const op of copyOperations) {
    const count = await op.targetCount();
    if (count > 0) {
      throw new Error(
        `Target table ${op.name} already contains ${count} row(s). Aborting to avoid overwriting data.`,
      );
    }
  }
}

async function main() {
  console.log(`Source SQLite URL: ${sourceUrl}`);
  console.log(`Resolved SQLite path: ${sqliteFilePath}`);
  console.log(`Target Postgres URL: ${maskConnectionString(targetUrl)}`);

  await ensureTargetIsEmpty();

  for (const op of copyOperations) {
    const rows = await op.pull();
    if (!rows.length) {
      console.log(`Skipping ${op.name}: no rows to migrate.`);
      continue;
    }

    const inserted = await op.push(rows);
    console.log(`Copied ${inserted}/${rows.length} row(s) into ${op.name}.`);
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.$disconnect();
  });
