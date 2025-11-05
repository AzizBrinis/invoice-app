import { prisma } from "@/lib/prisma";
import { getSettings } from "@/server/settings";
import { requireUser } from "@/lib/auth";

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

async function nextNumber(type: "DEVIS" | "FACTURE", providedUserId?: string) {
  const userId =
    providedUserId ?? (await requireUser()).id;
  const settings = await getSettings(userId);
  const isQuote = type === "DEVIS";
  const prefix = isQuote
    ? settings.quoteNumberPrefix
    : settings.invoiceNumberPrefix;
  const resetAnnually = settings.resetNumberingAnnually;
  const year = resetAnnually ? new Date().getFullYear() : 0;

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
          prefix,
          counter: 1,
        },
      });

      return formatNumber(prefix, created.year, created.counter, resetAnnually);
    }

    const updated = await tx.numberingSequence.update({
      where: { id: existing.id },
      data: {
        prefix,
        counter: { increment: 1 },
      },
    });

    return formatNumber(
      prefix,
      updated.year,
      updated.counter,
      resetAnnually,
    );
  });

  return number;
}

export async function nextQuoteNumber(userId?: string) {
  return nextNumber("DEVIS", userId);
}

export async function nextInvoiceNumber(userId?: string) {
  return nextNumber("FACTURE", userId);
}
