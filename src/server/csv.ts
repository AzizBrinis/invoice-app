import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

function toCsv<T extends Record<string, string | number | null | undefined>>(
  items: T[],
  headers: { key: keyof T; label: string }[],
) {
  const headerRow = headers.map((header) => header.label).join(";");
  const rows = items.map((item) =>
    headers
      .map((header) => {
        const value = item[header.key];
        if (value == null) {
          return "";
        }
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(";"),
  );
  return [headerRow, ...rows].join("\n");
}

export async function exportClientsCsv() {
  const clients = await prisma.client.findMany({
    orderBy: { displayName: "asc" },
  });

  return toCsv(
    clients.map((client) => ({
      name: client.displayName,
      company: client.companyName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      vat: client.vatNumber ?? "",
      address: client.address ?? "",
      active: client.isActive ? "Actif" : "Inactif",
      notes: client.notes ?? "",
      updatedAt: formatDate(client.updatedAt),
    })),
    [
      { key: "name", label: "Nom" },
      { key: "company", label: "Société" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Téléphone" },
      { key: "vat", label: "TVA" },
      { key: "address", label: "Adresse" },
      { key: "active", label: "Statut" },
      { key: "notes", label: "Notes" },
      { key: "updatedAt", label: "Dernière mise à jour" },
    ],
  );
}

export async function exportProductsCsv() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
  });
  const settings = await getSettings();
  const currencyCode = settings.defaultCurrency as CurrencyCode;

  return toCsv(
    products.map((product) => ({
      sku: product.sku,
      name: product.name,
      category: product.category ?? "",
      unit: product.unit,
      priceHT: formatCurrency(fromCents(product.priceHTCents, currencyCode), currencyCode),
      priceTTC: formatCurrency(fromCents(product.priceTTCCents, currencyCode), currencyCode),
      vat: product.vatRate,
      discount: product.defaultDiscountRate ?? "",
      active: product.isActive ? "Actif" : "Inactif",
    })),
    [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Nom" },
      { key: "category", label: "Catégorie" },
      { key: "unit", label: "Unité" },
      { key: "priceHT", label: `Prix HT (${currencyCode})` },
      { key: "priceTTC", label: `Prix TTC (${currencyCode})` },
      { key: "vat", label: "TVA (%)" },
      { key: "discount", label: "Remise (%)" },
      { key: "active", label: "Statut" },
    ],
  );
}

export async function exportQuotesCsv() {
  const quotes = await prisma.quote.findMany({
    orderBy: { issueDate: "desc" },
    include: { client: true },
  });

  return toCsv(
    quotes.map((quote) => ({
      number: quote.number,
      client: quote.client.displayName,
      status: quote.status,
      issueDate: formatDate(quote.issueDate),
      validUntil: quote.validUntil ? formatDate(quote.validUntil) : "",
      totalHT: formatCurrency(fromCents(quote.subtotalHTCents, quote.currency), quote.currency),
      totalTTC: formatCurrency(fromCents(quote.totalTTCCents, quote.currency), quote.currency),
      currency: quote.currency,
    })),
    [
      { key: "number", label: "Numéro" },
      { key: "client", label: "Client" },
      { key: "status", label: "Statut" },
      { key: "issueDate", label: "Date émission" },
      { key: "validUntil", label: "Validité" },
      { key: "totalHT", label: "Total HT" },
      { key: "totalTTC", label: "Total TTC" },
      { key: "currency", label: "Devise" },
    ],
  );
}

export async function exportInvoicesCsv() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { issueDate: "desc" },
    include: { client: true },
  });

  return toCsv(
    invoices.map((invoice) => ({
      number: invoice.number,
      client: invoice.client.displayName,
      status: invoice.status,
      issueDate: formatDate(invoice.issueDate),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : "",
      totalHT: formatCurrency(fromCents(invoice.subtotalHTCents, invoice.currency), invoice.currency),
      totalTTC: formatCurrency(fromCents(invoice.totalTTCCents, invoice.currency), invoice.currency),
      amountPaid: formatCurrency(fromCents(invoice.amountPaidCents, invoice.currency), invoice.currency),
      currency: invoice.currency,
    })),
    [
      { key: "number", label: "Numéro" },
      { key: "client", label: "Client" },
      { key: "status", label: "Statut" },
      { key: "issueDate", label: "Date émission" },
      { key: "dueDate", label: "Date d'échéance" },
      { key: "totalHT", label: "Total HT" },
      { key: "totalTTC", label: "Total TTC" },
      { key: "amountPaid", label: "Montant payé" },
      { key: "currency", label: "Devise" },
    ],
  );
}

export async function exportPaymentsCsv() {
  const payments = await prisma.payment.findMany({
    orderBy: { date: "desc" },
    include: { invoice: true },
  });

  return toCsv(
    payments.map((payment) => ({
      invoiceNumber: payment.invoice.number,
      date: formatDate(payment.date),
      amount: formatCurrency(fromCents(payment.amountCents, payment.invoice.currency), payment.invoice.currency),
      method: payment.method ?? "",
      note: payment.note ?? "",
    })),
    [
      { key: "invoiceNumber", label: "Facture" },
      { key: "date", label: "Date" },
      { key: "amount", label: "Montant" },
      { key: "method", label: "Mode" },
      { key: "note", label: "Note" },
    ],
  );
}
