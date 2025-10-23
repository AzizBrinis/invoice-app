import { prisma } from "@/lib/prisma";
import { getSettings } from "@/server/settings";

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

async function nextNumber(type: "DEVIS" | "FACTURE") {
  const settings = await getSettings();
  const isQuote = type === "DEVIS";
  const prefix = isQuote
    ? settings.quoteNumberPrefix
    : settings.invoiceNumberPrefix;
  const resetAnnually = settings.resetNumberingAnnually;
  const year = resetAnnually ? new Date().getFullYear() : 0;

  const number = await prisma.$transaction(async (tx) => {
    const existing = await tx.numberingSequence.findUnique({
      where: {
        type_year: {
          type,
          year,
        },
      },
    });

    if (!existing) {
      const created = await tx.numberingSequence.create({
        data: {
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

export async function nextQuoteNumber() {
  return nextNumber("DEVIS");
}

export async function nextInvoiceNumber() {
  return nextNumber("FACTURE");
}
