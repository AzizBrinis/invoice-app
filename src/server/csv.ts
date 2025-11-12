import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

type CsvRow = Record<string, string | number | null | undefined>;
type CsvHeader<T extends CsvRow> = { key: keyof T; label: string };

const CSV_TEXT_ENCODER = new TextEncoder();
const EXPORT_BATCH_SIZE = 500; // Limit how many rows we keep in memory per request chunk.

function formatCsvValue(value: string | number | null | undefined) {
  if (value == null) {
    return "";
  }
  const sanitized = String(value).replace(/"/g, '""');
  return `"${sanitized}"`;
}

function streamCsv<T extends CsvRow>(
  headers: CsvHeader<T>[],
  getRowIterator: () => AsyncGenerator<T, void, void>,
) {
  const headerRow = `${headers.map((header) => header.label).join(";")}\n`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(CSV_TEXT_ENCODER.encode(headerRow));
        for await (const row of getRowIterator()) {
          const serializedRow = headers
            .map(({ key }) => formatCsvValue(row[key]))
            .join(";");
          controller.enqueue(CSV_TEXT_ENCODER.encode(`${serializedRow}\n`));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function* paginateModel<T extends { id: string }>(
  fetchPage: (cursor?: string) => Promise<T[]>,
) {
  let cursor: string | undefined;

  while (true) {
    const page = await fetchPage(cursor);
    if (page.length === 0) {
      break;
    }

    for (const item of page) {
      yield item;
    }

    cursor = page[page.length - 1].id;
  }
}

type ClientCsvRow = {
  name: string;
  company: string;
  email: string;
  phone: string;
  vat: string;
  address: string;
  active: string;
  notes: string;
  updatedAt: string;
};

const clientHeaders: CsvHeader<ClientCsvRow>[] = [
  { key: "name", label: "Nom" },
  { key: "company", label: "Société" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Téléphone" },
  { key: "vat", label: "TVA" },
  { key: "address", label: "Adresse" },
  { key: "active", label: "Statut" },
  { key: "notes", label: "Notes" },
  { key: "updatedAt", label: "Dernière mise à jour" },
];

async function* clientRows(userId: string) {
  for await (const client of paginateModel((cursor) =>
    prisma.client.findMany({
      where: { userId },
      orderBy: [
        { displayName: "asc" },
        { id: "asc" },
      ],
      take: EXPORT_BATCH_SIZE,
      select: {
        id: true,
        displayName: true,
        companyName: true,
        email: true,
        phone: true,
        vatNumber: true,
        address: true,
        isActive: true,
        notes: true,
        updatedAt: true,
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }),
  )) {
    yield {
      name: client.displayName,
      company: client.companyName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      vat: client.vatNumber ?? "",
      address: client.address ?? "",
      active: client.isActive ? "Actif" : "Inactif",
      notes: client.notes ?? "",
      updatedAt: formatDate(client.updatedAt),
    };
  }
}

export async function exportClientsCsv() {
  const { id: userId } = await requireUser();
  return streamCsv<ClientCsvRow>(clientHeaders, () => clientRows(userId));
}

type ProductCsvRow = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  priceHT: string;
  priceTTC: string;
  vat: number | null;
  discount: number | string;
  active: string;
};

function productHeaders(currencyCode: CurrencyCode): CsvHeader<ProductCsvRow>[] {
  return [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Nom" },
    { key: "category", label: "Catégorie" },
    { key: "unit", label: "Unité" },
    { key: "priceHT", label: `Prix HT (${currencyCode})` },
    { key: "priceTTC", label: `Prix TTC (${currencyCode})` },
    { key: "vat", label: "TVA (%)" },
    { key: "discount", label: "Remise (%)" },
    { key: "active", label: "Statut" },
  ];
}

async function* productRows(userId: string, currencyCode: CurrencyCode) {
  for await (const product of paginateModel((cursor) =>
    prisma.product.findMany({
      where: { userId },
      orderBy: [
        { name: "asc" },
        { id: "asc" },
      ],
      take: EXPORT_BATCH_SIZE,
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        unit: true,
        priceHTCents: true,
        priceTTCCents: true,
        vatRate: true,
        defaultDiscountRate: true,
        isActive: true,
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }),
  )) {
    yield {
      sku: product.sku,
      name: product.name,
      category: product.category ?? "",
      unit: product.unit,
      priceHT: formatCurrency(fromCents(product.priceHTCents, currencyCode), currencyCode),
      priceTTC: formatCurrency(fromCents(product.priceTTCCents, currencyCode), currencyCode),
      vat: product.vatRate,
      discount: product.defaultDiscountRate ?? "",
      active: product.isActive ? "Actif" : "Inactif",
    };
  }
}

export async function exportProductsCsv() {
  const { id: userId } = await requireUser();
  const settings = await getSettings(userId);
  const currencyCode = settings.defaultCurrency as CurrencyCode;

  return streamCsv<ProductCsvRow>(
    productHeaders(currencyCode),
    () => productRows(userId, currencyCode),
  );
}

type QuoteCsvRow = {
  number: string;
  client: string;
  status: string;
  issueDate: string;
  validUntil: string;
  totalHT: string;
  totalTTC: string;
  currency: string;
};

const quoteHeaders: CsvHeader<QuoteCsvRow>[] = [
  { key: "number", label: "Numéro" },
  { key: "client", label: "Client" },
  { key: "status", label: "Statut" },
  { key: "issueDate", label: "Date émission" },
  { key: "validUntil", label: "Validité" },
  { key: "totalHT", label: "Total HT" },
  { key: "totalTTC", label: "Total TTC" },
  { key: "currency", label: "Devise" },
];

async function* quoteRows(userId: string) {
  for await (const quote of paginateModel((cursor) =>
    prisma.quote.findMany({
      where: { userId },
      orderBy: [
        { issueDate: "desc" },
        { id: "desc" },
      ],
      take: EXPORT_BATCH_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        validUntil: true,
        subtotalHTCents: true,
        totalTTCCents: true,
        currency: true,
        client: {
          select: {
            displayName: true,
          },
        },
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }),
  )) {
    yield {
      number: quote.number,
      client: quote.client.displayName,
      status: quote.status,
      issueDate: formatDate(quote.issueDate),
      validUntil: quote.validUntil ? formatDate(quote.validUntil) : "",
      totalHT: formatCurrency(
        fromCents(quote.subtotalHTCents, quote.currency),
        quote.currency as CurrencyCode,
      ),
      totalTTC: formatCurrency(
        fromCents(quote.totalTTCCents, quote.currency),
        quote.currency as CurrencyCode,
      ),
      currency: quote.currency,
    };
  }
}

export async function exportQuotesCsv() {
  const { id: userId } = await requireUser();
  return streamCsv<QuoteCsvRow>(quoteHeaders, () => quoteRows(userId));
}

type InvoiceCsvRow = {
  number: string;
  client: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalHT: string;
  totalTTC: string;
  amountPaid: string;
  currency: string;
};

const invoiceHeaders: CsvHeader<InvoiceCsvRow>[] = [
  { key: "number", label: "Numéro" },
  { key: "client", label: "Client" },
  { key: "status", label: "Statut" },
  { key: "issueDate", label: "Date émission" },
  { key: "dueDate", label: "Date d'échéance" },
  { key: "totalHT", label: "Total HT" },
  { key: "totalTTC", label: "Total TTC" },
  { key: "amountPaid", label: "Montant payé" },
  { key: "currency", label: "Devise" },
];

async function* invoiceRows(userId: string) {
  for await (const invoice of paginateModel((cursor) =>
    prisma.invoice.findMany({
      where: { userId },
      orderBy: [
        { issueDate: "desc" },
        { id: "desc" },
      ],
      take: EXPORT_BATCH_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        subtotalHTCents: true,
        totalTTCCents: true,
        amountPaidCents: true,
        currency: true,
        client: {
          select: {
            displayName: true,
          },
        },
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }),
  )) {
    yield {
      number: invoice.number,
      client: invoice.client.displayName,
      status: invoice.status,
      issueDate: formatDate(invoice.issueDate),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : "",
      totalHT: formatCurrency(
        fromCents(invoice.subtotalHTCents, invoice.currency),
        invoice.currency as CurrencyCode,
      ),
      totalTTC: formatCurrency(
        fromCents(invoice.totalTTCCents, invoice.currency),
        invoice.currency as CurrencyCode,
      ),
      amountPaid: formatCurrency(
        fromCents(invoice.amountPaidCents, invoice.currency),
        invoice.currency as CurrencyCode,
      ),
      currency: invoice.currency,
    };
  }
}

export async function exportInvoicesCsv() {
  const { id: userId } = await requireUser();
  return streamCsv<InvoiceCsvRow>(invoiceHeaders, () => invoiceRows(userId));
}

type PaymentCsvRow = {
  invoiceNumber: string;
  date: string;
  amount: string;
  method: string;
  note: string;
};

const paymentHeaders: CsvHeader<PaymentCsvRow>[] = [
  { key: "invoiceNumber", label: "Facture" },
  { key: "date", label: "Date" },
  { key: "amount", label: "Montant" },
  { key: "method", label: "Mode" },
  { key: "note", label: "Note" },
];

async function* paymentRows(userId: string) {
  for await (const payment of paginateModel((cursor) =>
    prisma.payment.findMany({
      where: { userId },
      orderBy: [
        { date: "desc" },
        { id: "desc" },
      ],
      take: EXPORT_BATCH_SIZE,
      select: {
        id: true,
        date: true,
        amountCents: true,
        method: true,
        note: true,
        invoice: {
          select: {
            number: true,
            currency: true,
          },
        },
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }),
  )) {
    yield {
      invoiceNumber: payment.invoice.number,
      date: formatDate(payment.date),
      amount: formatCurrency(
        fromCents(payment.amountCents, payment.invoice.currency),
        payment.invoice.currency as CurrencyCode,
      ),
      method: payment.method ?? "",
      note: payment.note ?? "",
    };
  }
}

export async function exportPaymentsCsv() {
  const { id: userId } = await requireUser();
  return streamCsv<PaymentCsvRow>(paymentHeaders, () => paymentRows(userId));
}
