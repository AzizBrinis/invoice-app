import { prisma } from "@/lib/prisma";
import { listClients } from "@/server/clients";
import { listInvoices } from "@/server/invoices";
import { listQuotes } from "@/server/quotes";
import { getSettings } from "@/server/settings";
import { MessagerieWorkspace } from "@/app/(app)/messagerie/workspace";

export default async function MessageriePage() {
  const [clientsResult, invoicesResult, quotesResult, settings, auditLogs] =
    await Promise.all([
      listClients({ pageSize: 50 }),
      listInvoices({ pageSize: 50 }),
      listQuotes({ pageSize: 50 }),
      getSettings(),
      prisma.emailLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  const clients = clientsResult.items.map((client) => ({
    id: client.id,
    displayName: client.displayName,
    companyName: client.companyName ?? null,
    email: client.email ?? null,
    phone: client.phone ?? null,
    vatNumber: client.vatNumber ?? null,
    address: client.address ?? null,
  }));

  const invoices = invoicesResult.items.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    clientId: invoice.clientId,
    clientName: invoice.client.displayName,
    totalCents: invoice.totalTTCCents,
    currency: invoice.currency,
    issueDate: invoice.issueDate.toISOString(),
    status: invoice.status,
  }));

  const quotes = quotesResult.items.map((quote) => ({
    id: quote.id,
    number: quote.number,
    clientId: quote.clientId,
    clientName: quote.client.displayName,
    totalCents: quote.totalTTCCents,
    currency: quote.currency,
    issueDate: quote.issueDate.toISOString(),
    status: quote.status,
  }));

  const logs = auditLogs.map((log) => ({
    id: log.id,
    documentType: log.documentType,
    documentId: log.documentId,
    to: log.to,
    subject: log.subject,
    body: log.body ?? null,
    status: log.status,
    sentAt: log.sentAt ? log.sentAt.toISOString() : null,
    createdAt: log.createdAt.toISOString(),
    error: log.error ?? null,
  }));

  return (
    <MessagerieWorkspace
      clients={clients}
      invoices={invoices}
      quotes={quotes}
      auditLogs={logs}
      company={{
        name: settings.companyName,
        email: settings.email ?? null,
        phone: settings.phone ?? null,
        address: settings.address ?? null,
      }}
    />
  );
}
