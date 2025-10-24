import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

async function importModule<T>(modulePath: string): Promise<T> {
  return (await import(modulePath)) as T;
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/prisma/dev.db";
  process.env.DATABASE_URL = databaseUrl;

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const samplesDir = path.join(rootDir, "audit", "samples");
  await ensureDir(samplesDir);

  const { exportInvoicesCsv, exportQuotesCsv, exportPaymentsCsv, exportClientsCsv, exportProductsCsv } = await importModule<
    typeof import("../../src/server/csv")
  >("../../src/server/csv");
  const pdfModule = await importModule<typeof import("../../src/server/pdf")>("../../src/server/pdf");
  const { prisma } = await importModule<typeof import("../../src/lib/prisma")>("../../src/lib/prisma");
  const { formatCurrency, formatDate } = await importModule<
    typeof import("../../src/lib/formatters")
  >("../../src/lib/formatters");
  const { fromCents } = await importModule<typeof import("../../src/lib/money")>("../../src/lib/money");

  const [invoicesCsv, quotesCsv, paymentsCsv, clientsCsv, productsCsv] = await Promise.all([
    exportInvoicesCsv(),
    exportQuotesCsv(),
    exportPaymentsCsv(),
    exportClientsCsv(),
    exportProductsCsv(),
  ]);

  await Promise.all([
    fs.writeFile(path.join(samplesDir, "factures.csv"), invoicesCsv, "utf8"),
    fs.writeFile(path.join(samplesDir, "devis.csv"), quotesCsv, "utf8"),
    fs.writeFile(path.join(samplesDir, "paiements.csv"), paymentsCsv, "utf8"),
    fs.writeFile(path.join(samplesDir, "clients.csv"), clientsCsv, "utf8"),
    fs.writeFile(path.join(samplesDir, "produits.csv"), productsCsv, "utf8"),
  ]);

  const invoice = await prisma.invoice.findFirst({
    orderBy: { issueDate: "desc" },
    include: { client: true },
  });
  const quote = await prisma.quote.findFirst({
    orderBy: { issueDate: "desc" },
    include: { client: true },
  });

  if (!invoice || !quote) {
    throw new Error("Les données de démonstration sont nécessaires pour générer les échantillons");
  }

  let pdfError: unknown = null;
  try {
    const invoicePdf = await pdfModule.generateInvoicePdf(invoice.id);
    const quotePdf = await pdfModule.generateQuotePdf(quote.id);
    await Promise.all([
      fs.writeFile(path.join(samplesDir, `facture-${invoice.number}.pdf`), invoicePdf),
      fs.writeFile(path.join(samplesDir, `devis-${quote.number}.pdf`), quotePdf),
    ]);
  } catch (error) {
    pdfError = error;
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await fs.writeFile(
      path.join(samplesDir, "pdf-generation-error.txt"),
      `Echec de génération PDF : ${message}`,
      "utf8",
    );
  }

  const invoiceAmount = formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency);
  const invoiceEmailSubject = `Votre facture ${invoice.number} — ${invoiceAmount}`;
  const invoiceEmailBody = `Bonjour ${invoice.client.displayName},\n\nVeuillez trouver ci-joint la facture ${invoice.number} du ${formatDate(
    invoice.issueDate,
  )}.\n\nMontant TTC : ${invoiceAmount}.\n\nCordialement,\nfacturation@example.com`;

  await fs.writeFile(
    path.join(samplesDir, `facture-${invoice.number}-email.txt`),
    `${invoiceEmailSubject}\n\n${invoiceEmailBody}`,
    "utf8",
  );

  const quoteAmount = formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency);
  const quoteEmailSubject = `Votre devis ${quote.number} — ${quoteAmount}`;
  const quoteEmailBody = `Bonjour ${quote.client.displayName},\n\nVeuillez trouver ci-joint le devis ${quote.number} du ${formatDate(
    quote.issueDate,
  )}.\n\nMontant TTC : ${quoteAmount}.\n\nCordialement,\nfacturation@example.com`;

  await fs.writeFile(
    path.join(samplesDir, `devis-${quote.number}-email.txt`),
    `${quoteEmailSubject}\n\n${quoteEmailBody}`,
    "utf8",
  );

  await prisma.$disconnect();

  if (pdfError) {
    console.warn("La génération PDF a échoué. Consultez audit/samples/pdf-generation-error.txt pour les détails.");
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => {
      process.exit(process.exitCode ?? 0);
    }, 250);
  });
