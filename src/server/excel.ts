import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getClientPaymentPeriodReport } from "@/server/client-payments";

function escapeXml(value: string | number | null | undefined) {
  if (value == null) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createStringCell(value: string | number | null | undefined) {
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function createRow(values: Array<string | number | null | undefined>) {
  return `<Row>${values.map((value) => createStringCell(value)).join("")}</Row>`;
}

export async function generateClientPaymentsExcelForUser(
  userId: string,
  filters: {
    clientId?: string | null;
    dateFrom?: Date | null;
    dateTo?: Date | null;
    search?: string | null;
    currency?: string | null;
  },
) {
  const report = await getClientPaymentPeriodReport(filters, userId);
  const periodLabel =
    report.filters.dateFrom || report.filters.dateTo
      ? `${report.filters.dateFrom ? formatDate(report.filters.dateFrom) : "Début"} - ${
          report.filters.dateTo ? formatDate(report.filters.dateTo) : "Aujourd’hui"
        }`
      : "Toutes les périodes";

  const rows = [
    createRow(["Rapport paiements clients"]),
    createRow(["Période", periodLabel]),
    createRow([
      "Recherche",
      report.filters.search?.trim() ? report.filters.search : "Aucune",
    ]),
    createRow(["Paiements", report.totals.paymentCount]),
    createRow(["Reçus générés", report.totals.receiptCount]),
    createRow(["Clients concernés", report.totals.clientCount]),
    createRow([]),
    createRow([
      "Date",
      "Client",
      "Société",
      "Description",
      "Référence",
      "Mode",
      "Services",
      "Reçu",
      "Montant",
      "Devise",
      "Note",
    ]),
    ...report.items.map((payment) =>
      createRow([
        formatDate(payment.date),
        payment.client.displayName,
        payment.client.companyName ?? "",
        payment.description ?? "Paiement client",
        payment.reference ?? "",
        payment.method ?? "",
        payment.serviceLinks.map((link) => link.titleSnapshot).join(", "),
        payment.receiptNumber ?? "À générer",
        formatCurrency(
          fromCents(payment.amountCents, payment.currency),
          payment.currency,
        ),
        payment.currency,
        payment.note ?? "",
      ]),
    ),
  ].join("");

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40"
>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center" />
      <Borders />
      <Font ss:FontName="Calibri" ss:Size="11" />
      <Interior />
      <NumberFormat />
      <Protection />
    </Style>
  </Styles>
  <Worksheet ss:Name="Paiements">
    <Table>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;

  return Buffer.from(workbook, "utf8");
}
