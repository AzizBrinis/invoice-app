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

type CreateManyArgs<TRow> = {
  data: Prisma.Enumerable<TRow>;
  skipDuplicates?: boolean;
};

const createMany =
  <TRow>(
    createManyFn: (args: CreateManyArgs<TRow>) => Promise<Prisma.BatchPayload>,
  ) =>
  async (rows: unknown[]) => {
    if (!rows.length) {
      return 0;
    }

    const typedRows = rows as TRow[];
    const args: CreateManyArgs<TRow> = {
      data: typedRows,
      skipDuplicates: true,
    };

    const { count } = await createManyFn(args);
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
    push: createMany<Prisma.UserCreateManyInput>((args) =>
      postgres.user.createMany(args),
    ),
    targetCount: () => postgres.user.count(),
  },
  {
    name: "Session",
    pull: pull("Session"),
    push: createMany<Prisma.SessionCreateManyInput>((args) =>
      postgres.session.createMany(args),
    ),
    targetCount: () => postgres.session.count(),
  },
  {
    name: "PdfTemplate",
    pull: pull("PdfTemplate"),
    push: createMany<Prisma.PdfTemplateCreateManyInput>((args) =>
      postgres.pdfTemplate.createMany(args),
    ),
    targetCount: () => postgres.pdfTemplate.count(),
  },
  {
    name: "CompanySettings",
    pull: pull("CompanySettings"),
    push: createMany<Prisma.CompanySettingsCreateManyInput>((args) =>
      postgres.companySettings.createMany(args),
    ),
    targetCount: () => postgres.companySettings.count(),
  },
  {
    name: "WebsiteConfig",
    pull: pull("WebsiteConfig"),
    push: createMany<Prisma.WebsiteConfigCreateManyInput>((args) =>
      postgres.websiteConfig.createMany(args),
    ),
    targetCount: () => postgres.websiteConfig.count(),
  },
  {
    name: "MessagingSettings",
    pull: pull("MessagingSettings"),
    push: createMany<Prisma.MessagingSettingsCreateManyInput>((args) =>
      postgres.messagingSettings.createMany(args),
    ),
    targetCount: () => postgres.messagingSettings.count(),
  },
  {
    name: "MessagingSavedResponse",
    pull: pull("MessagingSavedResponse"),
    push: createMany<Prisma.MessagingSavedResponseCreateManyInput>((args) =>
      postgres.messagingSavedResponse.createMany(args),
    ),
    targetCount: () => postgres.messagingSavedResponse.count(),
  },
  {
    name: "MessagingAutoReplyLog",
    pull: pull("MessagingAutoReplyLog"),
    push: createMany<Prisma.MessagingAutoReplyLogCreateManyInput>((args) =>
      postgres.messagingAutoReplyLog.createMany(args),
    ),
    targetCount: () => postgres.messagingAutoReplyLog.count(),
  },
  {
    name: "MessagingScheduledEmail",
    pull: pull("MessagingScheduledEmail"),
    push: createMany<Prisma.MessagingScheduledEmailCreateManyInput>((args) =>
      postgres.messagingScheduledEmail.createMany(args),
    ),
    targetCount: () => postgres.messagingScheduledEmail.count(),
  },
  {
    name: "MessagingScheduledAttachment",
    pull: pull("MessagingScheduledAttachment"),
    push: createMany<Prisma.MessagingScheduledAttachmentCreateManyInput>((args) =>
      postgres.messagingScheduledAttachment.createMany(args),
    ),
    targetCount: () => postgres.messagingScheduledAttachment.count(),
  },
  {
    name: "MessagingEmail",
    pull: pull("MessagingEmail"),
    push: createMany<Prisma.MessagingEmailCreateManyInput>((args) =>
      postgres.messagingEmail.createMany(args),
    ),
    targetCount: () => postgres.messagingEmail.count(),
  },
  {
    name: "MessagingEmailRecipient",
    pull: pull("MessagingEmailRecipient"),
    push: createMany<Prisma.MessagingEmailRecipientCreateManyInput>((args) =>
      postgres.messagingEmailRecipient.createMany(args),
    ),
    targetCount: () => postgres.messagingEmailRecipient.count(),
  },
  {
    name: "MessagingEmailLink",
    pull: pull("MessagingEmailLink"),
    push: createMany<Prisma.MessagingEmailLinkCreateManyInput>((args) =>
      postgres.messagingEmailLink.createMany(args),
    ),
    targetCount: () => postgres.messagingEmailLink.count(),
  },
  {
    name: "MessagingEmailLinkRecipient",
    pull: pull("MessagingEmailLinkRecipient"),
    push: createMany<Prisma.MessagingEmailLinkRecipientCreateManyInput>((args) =>
      postgres.messagingEmailLinkRecipient.createMany(args),
    ),
    targetCount: () => postgres.messagingEmailLinkRecipient.count(),
  },
  {
    name: "MessagingEmailEvent",
    pull: pull("MessagingEmailEvent"),
    push: createMany<Prisma.MessagingEmailEventCreateManyInput>((args) =>
      postgres.messagingEmailEvent.createMany(args),
    ),
    targetCount: () => postgres.messagingEmailEvent.count(),
  },
  {
    name: "Client",
    pull: pull("Client"),
    push: createMany<Prisma.ClientCreateManyInput>((args) =>
      postgres.client.createMany(args),
    ),
    targetCount: () => postgres.client.count(),
  },
  {
    name: "Product",
    pull: pull("Product"),
    push: createMany<Prisma.ProductCreateManyInput>((args) =>
      postgres.product.createMany(args),
    ),
    targetCount: () => postgres.product.count(),
  },
  {
    name: "NumberingSequence",
    pull: pull("NumberingSequence"),
    push: createMany<Prisma.NumberingSequenceCreateManyInput>((args) =>
      postgres.numberingSequence.createMany(args),
    ),
    targetCount: () => postgres.numberingSequence.count(),
  },
  {
    name: "Quote",
    pull: pull("Quote"),
    push: createMany<Prisma.QuoteCreateManyInput>((args) =>
      postgres.quote.createMany(args),
    ),
    targetCount: () => postgres.quote.count(),
  },
  {
    name: "QuoteLine",
    pull: pull("QuoteLine"),
    push: createMany<Prisma.QuoteLineCreateManyInput>((args) =>
      postgres.quoteLine.createMany(args),
    ),
    targetCount: () => postgres.quoteLine.count(),
  },
  {
    name: "Invoice",
    pull: pull("Invoice"),
    push: createMany<Prisma.InvoiceCreateManyInput>((args) =>
      postgres.invoice.createMany(args),
    ),
    targetCount: () => postgres.invoice.count(),
  },
  {
    name: "InvoiceLine",
    pull: pull("InvoiceLine"),
    push: createMany<Prisma.InvoiceLineCreateManyInput>((args) =>
      postgres.invoiceLine.createMany(args),
    ),
    targetCount: () => postgres.invoiceLine.count(),
  },
  {
    name: "Payment",
    pull: pull("Payment"),
    push: createMany<Prisma.PaymentCreateManyInput>((args) =>
      postgres.payment.createMany(args),
    ),
    targetCount: () => postgres.payment.count(),
  },
  {
    name: "InvoiceAuditLog",
    pull: pull("InvoiceAuditLog"),
    push: createMany<Prisma.InvoiceAuditLogCreateManyInput>((args) =>
      postgres.invoiceAuditLog.createMany(args),
    ),
    targetCount: () => postgres.invoiceAuditLog.count(),
  },
  {
    name: "EmailLog",
    pull: pull("EmailLog"),
    push: createMany<Prisma.EmailLogCreateManyInput>((args) =>
      postgres.emailLog.createMany(args),
    ),
    targetCount: () => postgres.emailLog.count(),
  },
  {
    name: "SpamDetectionLog",
    pull: pull("SpamDetectionLog"),
    push: createMany<Prisma.SpamDetectionLogCreateManyInput>((args) =>
      postgres.spamDetectionLog.createMany(args),
    ),
    targetCount: () => postgres.spamDetectionLog.count(),
  },
  {
    name: "SpamSenderReputation",
    pull: pull("SpamSenderReputation"),
    push: createMany<Prisma.SpamSenderReputationCreateManyInput>((args) =>
      postgres.spamSenderReputation.createMany(args),
    ),
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
