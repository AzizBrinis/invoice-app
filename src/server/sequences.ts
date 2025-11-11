import { prisma } from "@/lib/prisma";
import { getSettings } from "@/server/settings";
import { requireUser } from "@/lib/auth";

type NumberingOverrides = {
  prefix?: string;
  resetAnnually?: boolean;
};

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
  type: "DEVIS" | "FACTURE",
  providedUserId?: string,
  overrides?: NumberingOverrides,
) {
  const userId = providedUserId ?? (await requireUser()).id;
  const isQuote = type === "DEVIS";

  let prefix = overrides?.prefix;
  let resetAnnually = overrides?.resetAnnually;

  if (prefix === undefined || resetAnnually === undefined) {
    const settings = await getSettings(userId);
    prefix = isQuote
      ? settings.quoteNumberPrefix
      : settings.invoiceNumberPrefix;
    resetAnnually = settings.resetNumberingAnnually;
  }

  const resolvedPrefix = prefix ?? (isQuote ? "DEV" : "FAC");
  const resolvedResetAnnually = Boolean(resetAnnually);
  const year = resolvedResetAnnually ? new Date().getFullYear() : 0;

  const number = await prisma.$transaction(async (tx) => {
    const existing = await tx.numberingSequence.findFirst({
      where: {
        userId,
        type,
        year,
      },
    });

    if (!existing) {
      const created = await tx.numberingSequence.create({
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

    const updated = await tx.numberingSequence.update({
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
  });

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
