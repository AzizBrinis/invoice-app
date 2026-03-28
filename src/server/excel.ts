import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getClientPaymentPeriodReport } from "@/server/client-payments";

type SpreadsheetValue = string | number | null | undefined;

type SpreadsheetCell = {
  value: SpreadsheetValue;
  styleId?: string;
  mergeAcross?: number;
};

type PaymentExportColumn = {
  heading: string;
  minChars: number;
  maxChars: number;
  wrap?: boolean;
};

const PAYMENT_EXPORT_COLUMNS: readonly PaymentExportColumn[] = [
  { heading: "Date", minChars: 12, maxChars: 14 },
  { heading: "Client", minChars: 18, maxChars: 28 },
  { heading: "Société", minChars: 18, maxChars: 28 },
  { heading: "Description", minChars: 20, maxChars: 36, wrap: true },
  { heading: "Référence", minChars: 14, maxChars: 24 },
  { heading: "Mode", minChars: 14, maxChars: 18 },
  { heading: "Services", minChars: 24, maxChars: 42, wrap: true },
  { heading: "Reçu", minChars: 14, maxChars: 18 },
  { heading: "Montant", minChars: 14, maxChars: 16 },
  { heading: "Devise", minChars: 10, maxChars: 10 },
  { heading: "Note", minChars: 20, maxChars: 40, wrap: true },
] as const;

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

function createStringCell(input: SpreadsheetCell | SpreadsheetValue) {
  const cell =
    typeof input === "object" && input !== null && "value" in input
      ? input
      : { value: input };
  const attributes = [
    cell.styleId ? ` ss:StyleID="${cell.styleId}"` : "",
    typeof cell.mergeAcross === "number"
      ? ` ss:MergeAcross="${cell.mergeAcross}"`
      : "",
  ].join("");

  return `<Cell${attributes}><Data ss:Type="String">${escapeXml(cell.value)}</Data></Cell>`;
}

function createRow(values: Array<SpreadsheetCell | SpreadsheetValue>) {
  return `<Row>${values.map((value) => createStringCell(value)).join("")}</Row>`;
}

function getCellTextLength(value: SpreadsheetValue) {
  if (value == null) {
    return 0;
  }

  return String(value)
    .split(/\r?\n/)
    .reduce((longestLineLength, line) => {
      const normalizedLength = line.trim().replace(/\s+/g, " ").length;
      return Math.max(longestLineLength, normalizedLength);
    }, 0);
}

function calculateColumnWidth(
  values: SpreadsheetValue[],
  options: { minChars: number; maxChars: number },
) {
  const longestValueLength = values.reduce<number>(
    (maxLength, value) => Math.max(maxLength, getCellTextLength(value)),
    0,
  );
  const boundedCharacterWidth = Math.min(
    options.maxChars,
    Math.max(options.minChars, longestValueLength + 2),
  );

  return Math.round(boundedCharacterWidth * 5.5 + 12);
}

function createColumnDefinitions(rows: SpreadsheetValue[][]) {
  return PAYMENT_EXPORT_COLUMNS.map((column, columnIndex) => {
    const width = calculateColumnWidth(
      rows.map((row) => row[columnIndex]),
      column,
    );

    return `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`;
  }).join("");
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

  const reportRows = report.items.map((payment) => [
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
  ]);
  const headerRow = PAYMENT_EXPORT_COLUMNS.map((column) => column.heading);
  const sizingRows = [
    ["Période", periodLabel],
    [
      "Recherche",
      report.filters.search?.trim() ? report.filters.search : "Aucune",
    ],
    ["Paiements", report.totals.paymentCount],
    ["Reçus générés", report.totals.receiptCount],
    ["Clients concernés", report.totals.clientCount],
    headerRow,
    ...reportRows,
  ];
  const columns = createColumnDefinitions(sizingRows);
  const rows = [
    createRow([
      {
        value: "Rapport paiements clients",
        mergeAcross: PAYMENT_EXPORT_COLUMNS.length - 1,
        styleId: "Title",
      },
    ]),
    createRow([
      { value: "Période", styleId: "SummaryLabel" },
      periodLabel,
    ]),
    createRow([
      { value: "Recherche", styleId: "SummaryLabel" },
      report.filters.search?.trim() ? report.filters.search : "Aucune",
    ]),
    createRow([{ value: "Paiements", styleId: "SummaryLabel" }, report.totals.paymentCount]),
    createRow([
      { value: "Reçus générés", styleId: "SummaryLabel" },
      report.totals.receiptCount,
    ]),
    createRow([
      { value: "Clients concernés", styleId: "SummaryLabel" },
      report.totals.clientCount,
    ]),
    createRow([]),
    createRow(
      headerRow.map((value) => ({ value, styleId: "Header" })),
    ),
    ...reportRows.map((row) =>
      createRow(
        row.map((value, columnIndex) => ({
          value,
          styleId: PAYMENT_EXPORT_COLUMNS[columnIndex]?.wrap
            ? "WrappedText"
            : undefined,
        })),
      ),
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
      <Alignment ss:Vertical="Top" />
      <Borders />
      <Font ss:FontName="Calibri" ss:Size="11" />
      <Interior />
      <NumberFormat />
      <Protection />
    </Style>
    <Style ss:ID="Title">
      <Alignment ss:Vertical="Center" />
      <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" />
    </Style>
    <Style ss:ID="SummaryLabel">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" />
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Vertical="Center" ss:WrapText="1" />
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" />
      <Interior ss:Color="#E5E7EB" ss:Pattern="Solid" />
    </Style>
    <Style ss:ID="WrappedText">
      <Alignment ss:Vertical="Top" ss:WrapText="1" />
    </Style>
  </Styles>
  <Worksheet ss:Name="Paiements">
    <Table>
      ${columns}
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;

  return Buffer.from(workbook, "utf8");
}
