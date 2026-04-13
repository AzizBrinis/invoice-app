import { prisma } from "@/lib/db";
import { getSettingsDocumentDefaults } from "@/server/settings";
import { requireUser } from "@/lib/auth";

type NumberingOverrides = {
  prefix?: string;
  resetAnnually?: boolean;
};

type SequenceDatabaseClient = Pick<typeof prisma, "numberingSequence">;

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

export async function nextInvoiceNumber(
  userId?: string,
  settings?: InvoiceNumberingSettings,
) {
  return nextNumber("FACTURE", userId, {
    prefix: settings?.invoiceNumberPrefix,
    resetAnnually: settings?.resetNumberingAnnually,
  });
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
