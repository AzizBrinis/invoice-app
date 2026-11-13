import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { generateId } from "@/lib/id";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { getSettingsDocumentDefaults } from "@/server/settings";
import { requireUser } from "@/lib/auth";

type NumberingOverrides = {
  prefix?: string;
  resetAnnually?: boolean;
};

type SequenceDatabaseClient = Pick<typeof prisma, "numberingSequence">;
type InvoiceSequenceDatabaseClient = Pick<typeof prisma, "$queryRaw">;

function formatNumber(
  prefix: string,
  year: number,
  counter: number,
  resetAnnually: boolean,
) {
  const padded = String(counter).padStart(4, "0");
  if (resetAnnually) {
    return `${prefix}-${year}-${padded}`;
  }
  return `${prefix}-${padded}`;
}

async function nextNumber(
  type: "DEVIS" | "FACTURE" | "RECU",
  providedUserId?: string,
  overrides?: NumberingOverrides,
  db?: SequenceDatabaseClient,
) {
  const userId = providedUserId ?? (await requireUser()).id;

  let prefix = overrides?.prefix;
  let resetAnnually = overrides?.resetAnnually;

  if (prefix === undefined || resetAnnually === undefined) {
    const settings = await getSettingsDocumentDefaults(userId);
    prefix =
      type === "DEVIS"
        ? settings.quoteNumberPrefix
        : type === "FACTURE"
          ? settings.invoiceNumberPrefix
          : overrides?.prefix ?? "REC";
    resetAnnually = settings.resetNumberingAnnually;
  }

  const resolvedPrefix =
    prefix ??
    (type === "DEVIS" ? "DEV" : type === "FACTURE" ? "FAC" : "REC");
  const resolvedResetAnnually = Boolean(resetAnnually);
  const year = resolvedResetAnnually ? new Date().getFullYear() : 0;

  const reserveNumber = async (sequenceDb: SequenceDatabaseClient) => {
    const existing = await sequenceDb.numberingSequence.findFirst({
      where: {
        userId,
        type,
        year,
      },
    });

    if (!existing) {
      const created = await sequenceDb.numberingSequence.create({
        data: {
          userId,
          type,
          year,
          prefix: resolvedPrefix,
          counter: 1,
        },
      });

      return formatNumber(
        resolvedPrefix,
        created.year,
        created.counter,
        resolvedResetAnnually,
      );
    }

    const updated = await sequenceDb.numberingSequence.update({
      where: { id: existing.id },
      data: {
        prefix: resolvedPrefix,
        counter: { increment: 1 },
      },
    });

    return formatNumber(
      resolvedPrefix,
      updated.year,
      updated.counter,
      resolvedResetAnnually,
    );
  };

  const number = db
    ? await reserveNumber(db)
    : await prisma.$transaction((tx) => reserveNumber(tx));

  return number;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reserves the next invoice number for a tenant.
 *
 * The number is `max(sequence counter, highest number already issued with the
 * same prefix/year) + 1`, so invoices whose number was typed manually in the
 * editor are never re-issued nor skipped back over. The sequence row is locked
 * (`SELECT … FOR UPDATE`) for the rest of the caller's transaction: when the
 * invoice is inserted in that same transaction, concurrent creations are
 * serialised and a failed insert rolls the counter back (no gap). The
 * `Invoice(userId, number)` unique index remains the final guard.
 */
/**
 * Calendar year in the business timezone (Africa/Tunis), not the server's
 * (UTC on Vercel): an invoice issued at 00:30 on 1 January in Tunis starts the
 * new year's series instead of extending the previous one.
 */
export function invoiceNumberingYear(now: Date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: DEFAULT_TIMEZONE, year: "numeric" }).format(now),
  );
}

async function reserveInvoiceNumber(
  db: InvoiceSequenceDatabaseClient,
  userId: string,
  prefix: string,
  resetAnnually: boolean,
) {
  const year = resetAnnually ? invoiceNumberingYear() : 0;
  const numberPattern = resetAnnually
    ? `^${escapeRegExp(prefix)}-${year}-([0-9]{1,9})$`
    : `^${escapeRegExp(prefix)}-([0-9]{1,9})$`;

  await db.$queryRaw(Prisma.sql`
    INSERT INTO "NumberingSequence" ("id", "userId", "type", "year", "prefix", "counter", "createdAt", "updatedAt")
    VALUES (${generateId("seq")}, ${userId}, CAST('FACTURE' AS "SequenceType"), ${year}, ${prefix}, 0, NOW(), NOW())
    ON CONFLICT ("userId", "type", "year") DO NOTHING
    RETURNING "id"
  `);
  const [sequence] = await db.$queryRaw<{ id: string; counter: number }[]>(Prisma.sql`
    SELECT "id", "counter" FROM "NumberingSequence"
    WHERE "userId" = ${userId} AND "type" = CAST('FACTURE' AS "SequenceType") AND "year" = ${year}
    FOR UPDATE
  `);
  if (!sequence) {
    throw new Error("Invoice numbering sequence could not be reserved");
  }
  const [issued] = await db.$queryRaw<{ highest: number | string | null }[]>(Prisma.sql`
    SELECT MAX(CAST(substring("number" FROM ${numberPattern}) AS integer)) AS "highest"
    FROM "Invoice"
    WHERE "userId" = ${userId} AND "number" ~ ${numberPattern}
  `);
  const next = Math.max(Number(sequence.counter) || 0, Number(issued?.highest ?? 0) || 0) + 1;
  await db.$queryRaw(Prisma.sql`
    UPDATE "NumberingSequence"
    SET "counter" = ${next}, "prefix" = ${prefix}, "updatedAt" = NOW()
    WHERE "id" = ${sequence.id}
    RETURNING "id"
  `);
  return formatNumber(prefix, year, next, resetAnnually);
}

type QuoteNumberingSettings = {
  quoteNumberPrefix: string;
  resetNumberingAnnually: boolean;
};

type InvoiceNumberingSettings = {
  invoiceNumberPrefix: string;
  resetNumberingAnnually: boolean;
};

type ReceiptNumberingSettings = {
  resetNumberingAnnually: boolean;
  receiptNumberPrefix?: string | null;
};

export async function nextQuoteNumber(
  userId?: string,
  settings?: QuoteNumberingSettings,
) {
  return nextNumber("DEVIS", userId, {
    prefix: settings?.quoteNumberPrefix,
    resetAnnually: settings?.resetNumberingAnnually,
  });
}

async function resolveInvoiceNumbering(
  userId: string,
  settings?: InvoiceNumberingSettings,
) {
  const resolved = settings ?? (await getSettingsDocumentDefaults(userId));
  return {
    prefix: resolved.invoiceNumberPrefix || "FAC",
    resetAnnually: Boolean(resolved.resetNumberingAnnually),
  };
}

export async function nextInvoiceNumber(
  userId?: string,
  settings?: InvoiceNumberingSettings,
) {
  const resolvedUserId = userId ?? (await requireUser()).id;
  const { prefix, resetAnnually } = await resolveInvoiceNumbering(resolvedUserId, settings);
  return prisma.$transaction((tx) =>
    reserveInvoiceNumber(tx, resolvedUserId, prefix, resetAnnually),
  );
}

/**
 * Same as `nextInvoiceNumber`, but inside the caller's transaction so the
 * reservation and the invoice insert commit (or roll back) together.
 */
export async function nextInvoiceNumberWithDatabaseClient(
  userId: string,
  settings: InvoiceNumberingSettings,
  db: InvoiceSequenceDatabaseClient,
) {
  const { prefix, resetAnnually } = await resolveInvoiceNumbering(userId, settings);
  return reserveInvoiceNumber(db, userId, prefix, resetAnnually);
}

export async function nextReceiptNumber(
  userId?: string,
  settings?: ReceiptNumberingSettings,
) {
  return nextNumber("RECU", userId, {
    prefix: settings?.receiptNumberPrefix ?? "REC",
    resetAnnually: settings?.resetNumberingAnnually,
  });
}

export async function nextReceiptNumberWithDatabaseClient(
  userId: string,
  settings: ReceiptNumberingSettings,
  db: SequenceDatabaseClient,
) {
  return nextNumber(
    "RECU",
    userId,
    {
      prefix: settings.receiptNumberPrefix ?? "REC",
      resetAnnually: settings.resetNumberingAnnually,
    },
    db,
  );
}
