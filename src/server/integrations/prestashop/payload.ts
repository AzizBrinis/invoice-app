import { z } from "zod";
import { CURRENCY_CODES, getCurrencyInfo } from "@/lib/currency";
import { calculateDocumentPrices } from "@/lib/document-line-pricing";
import { InvoiceStatus } from "@/lib/db/prisma-server";
import type { InvoiceInput } from "@/server/invoices";
import type { ClientContactInput } from "@/server/clients";

/**
 * Payload contract (schemaVersion 1) sent by the PrestaShop module.
 * Monetary amounts are decimal STRINGS in currency units (up to 6 decimals,
 * PrestaShop's own storage precision) to avoid float drift in PHP/JSON.
 */

const DECIMAL_PATTERN = /^\d{1,12}(?:\.\d{1,6})?$/;
const RATE_PATTERN = /^\d{1,3}(?:\.\d{1,3})?$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]+/g;

function cleanLine(value: string) {
  return value.replace(CONTROL_CHARS, " ").replace(/\s{2,}/g, " ").trim();
}

const requiredText = (max: number) =>
  z.string().max(max * 2).transform(cleanLine).pipe(z.string().min(1).max(max));

const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .nullish()
    .transform((value) => (value == null ? null : cleanLine(value) || null))
    .pipe(z.string().max(max).nullable());

const money = z
  .string()
  .regex(DECIMAL_PATTERN, "Montant décimal attendu sous forme de chaîne, ex. \"119.000000\"");

const taxRate = z
  .string()
  .regex(RATE_PATTERN, "Taux attendu sous forme de chaîne, ex. \"19.000\"")
  .refine((value) => Number(value) <= 100, "Le taux doit être compris entre 0 et 100");

const isoDateTime = z.iso.datetime({ offset: true });

const lineSchema = z.strictObject({
  productId: z.int().nonnegative(),
  productAttributeId: z.int().nonnegative().default(0),
  reference: optionalText(64),
  name: requiredText(255),
  quantity: z.int().min(1).max(100_000),
  unitPriceTaxExcl: money,
  unitPriceTaxIncl: money,
  taxRate,
});

const chargeSchema = z.strictObject({
  amountTaxExcl: money,
  amountTaxIncl: money,
  taxRate,
});

export const prestashopOrderPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  shop: z.strictObject({
    id: z.int().positive(),
    name: optionalText(128),
  }),
  order: z.strictObject({
    id: z.int().positive(),
    reference: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Référence de commande invalide"),
    createdAt: isoDateTime,
    currency: z.enum(CURRENCY_CODES),
    paymentMethod: requiredText(128),
    isPaid: z.boolean(),
    paidAt: isoDateTime.nullish(),
  }),
  customer: z.strictObject({
    id: z.int().positive().nullish(),
    email: z.email().max(254),
    firstName: requiredText(64),
    lastName: requiredText(64),
    company: optionalText(128),
    vatNumber: optionalText(64),
    phone: optionalText(32),
  }),
  billingAddress: z.strictObject({
    firstName: requiredText(64),
    lastName: requiredText(64),
    company: optionalText(128),
    vatNumber: optionalText(64),
    address1: requiredText(255),
    address2: optionalText(255),
    postcode: optionalText(16),
    city: requiredText(64),
    state: optionalText(64),
    country: requiredText(64),
    countryIso: z.string().regex(/^[A-Z]{2}$/).nullish(),
    phone: optionalText(32),
    phoneMobile: optionalText(32),
  }),
  lines: z.array(lineSchema).min(1).max(500),
  shipping: chargeSchema.extend({ carrierName: optionalText(128) }).nullish(),
  wrapping: chargeSchema.nullish(),
  discounts: z
    .array(
      z.strictObject({
        name: requiredText(128),
        amountTaxExcl: money,
        amountTaxIncl: money,
        freeShipping: z.boolean().default(false),
      }),
    )
    .max(50)
    .default([]),
  /**
   * Options chosen by the back-office employee when generating the invoice.
   * `vatRate` (optional) applies one VAT rate to every line, shipping and
   * wrapping: the amounts the customer paid (TTC) are kept and the HT/VAT split
   * is derived from that rate. Absent/null keeps each line's shop tax rate.
   * The invoice number is never accepted from the shop.
   */
  invoiceOptions: z
    .strictObject({
      vatRate: taxRate.nullish(),
    })
    .nullish(),
  /**
   * Timbre fiscal already charged by the shop at checkout (included in the
   * order totals, NOT in `lines`). The invoice then carries it as its timbre,
   * once, instead of adding another one; it must equal the tenant's timbre.
   */
  timbreFiscal: z
    .strictObject({
      amount: money,
    })
    .nullish(),
  totals: z.strictObject({
    productsTaxExcl: money,
    productsTaxIncl: money,
    discountsTaxExcl: money,
    discountsTaxIncl: money,
    shippingTaxExcl: money,
    shippingTaxIncl: money,
    wrappingTaxExcl: money,
    wrappingTaxIncl: money,
    totalTaxExcl: money,
    totalTaxIncl: money,
    totalPaid: money.nullish(),
  }),
});

export type PrestashopOrderPayload = z.infer<typeof prestashopOrderPayloadSchema>;

export type ValidationIssue = { path: string; message: string };

export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.slice(0, 50).map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

// ---------------------------------------------------------------------------
// Exact decimal helpers (no binary floating point on monetary input)
// ---------------------------------------------------------------------------

const TEN = BigInt(10);
const ONE = BigInt(1);

/** Round a non-negative decimal string half-up to `places` fraction digits, scaled to an integer. */
export function scaleDecimal(value: string, places: number): number {
  const [whole, fraction = ""] = value.split(".");
  const digits = (fraction + "0".repeat(places + 1)).slice(0, places + 1);
  let scaled = BigInt(whole) * TEN ** BigInt(places) + BigInt(digits.slice(0, places) || "0");
  if (Number(digits[places]) >= 5) scaled += ONE;
  return Number(scaled);
}

/** Amount in thousandths of a currency unit (the invoice-app document precision). */
export function thousandths(value: string) {
  return scaleDecimal(value, 3);
}

/** Document amounts are minor units that may carry a fraction up to 3 unit decimals. */
function thousandthsToDocumentMinor(value: number, currency: string) {
  return value / 10 ** (3 - getCurrencyInfo(currency).decimals);
}

export function toCurrencyMinor(value: string, currency: string) {
  return scaleDecimal(value, getCurrencyInfo(currency).decimals);
}

export function formatMinor(minor: number, currency: string) {
  const decimals = getCurrencyInfo(currency).decimals;
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const factor = 10 ** decimals;
  const whole = Math.floor(abs / factor);
  const fraction = String(abs % factor).padStart(decimals, "0");
  return decimals > 0 ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

// ---------------------------------------------------------------------------
// Mapping to the existing invoice model
// ---------------------------------------------------------------------------

export type MappedPrestashopOrder = {
  contact: ClientContactInput;
  clientMetadata: Record<string, unknown>;
  /** Invoice input without the clientId, which is resolved at persistence time. */
  invoice: Omit<InvoiceInput, "clientId">;
  expectedTotalTTCMinor: number;
  toleranceMinor: number;
  /** VAT rate chosen in PrestaShop for the whole invoice, or null for per-line shop rates. */
  vatRateOverride: number | null;
  /** Timbre fiscal charged by the shop (currency minor units), or null. */
  shopTimbreMinor: number | null;
  payment: { amountMinor: number; date: Date; method: string; note: string } | null;
};

export class PayloadConsistencyError extends Error {
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super("Incohérence dans les montants de la commande");
    this.name = "PayloadConsistencyError";
    this.issues = issues;
  }
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Tunis",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function joinName(first: string, last: string) {
  return `${first} ${last}`.replace(/\s{2,}/g, " ").trim();
}

function formatAddress(address: PrestashopOrderPayload["billingAddress"]) {
  const cityLine = [address.postcode, address.city].filter(Boolean).join(" ");
  return [address.address1, address.address2, cityLine, address.state, address.country]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

export function mapPrestashopOrder(
  payload: PrestashopOrderPayload,
  options: { totalTolerance: string; applyTimbre: boolean; recordPayments: boolean },
): MappedPrestashopOrder {
  const { order, totals, billingAddress, customer } = payload;
  const currency = order.currency;
  const issues: ValidationIssue[] = [];
  const toleranceThousandths = thousandths(options.totalTolerance);

  // --- Cross-field consistency checks -------------------------------------
  const shippingIncl = payload.shipping ? thousandths(payload.shipping.amountTaxIncl) : 0;
  if (shippingIncl !== thousandths(totals.shippingTaxIncl)) {
    issues.push({ path: "shipping.amountTaxIncl", message: "Doit correspondre à totals.shippingTaxIncl" });
  }
  const wrappingIncl = payload.wrapping ? thousandths(payload.wrapping.amountTaxIncl) : 0;
  if (wrappingIncl !== thousandths(totals.wrappingTaxIncl)) {
    issues.push({ path: "wrapping.amountTaxIncl", message: "Doit correspondre à totals.wrappingTaxIncl" });
  }

  const discountsExcl = thousandths(totals.discountsTaxExcl);
  const listedDiscountsExcl = payload.discounts.reduce(
    (sum, discount) => sum + thousandths(discount.amountTaxExcl),
    0,
  );
  if (Math.abs(listedDiscountsExcl - discountsExcl) > toleranceThousandths) {
    issues.push({ path: "discounts", message: "La somme des remises doit correspondre à totals.discountsTaxExcl" });
  }
  const chargeableExcl =
    thousandths(totals.productsTaxExcl) +
    thousandths(totals.shippingTaxExcl) +
    thousandths(totals.wrappingTaxExcl);
  if (discountsExcl > chargeableExcl) {
    issues.push({ path: "totals.discountsTaxExcl", message: "Les remises dépassent le montant de la commande" });
  }
  // The order's own totals must add up (PrestaShop stores them this way):
  // products - discounts + shipping + wrapping = total, both TTC and HT.
  for (const basis of ["TaxIncl", "TaxExcl"] as const) {
    const composed =
      thousandths(totals[`products${basis}`]) -
      thousandths(totals[`discounts${basis}`]) +
      thousandths(totals[`shipping${basis}`]) +
      thousandths(totals[`wrapping${basis}`]);
    if (Math.abs(composed - thousandths(totals[`total${basis}`])) > toleranceThousandths) {
      issues.push({
        path: `totals.total${basis}`,
        message: `Doit être égal à products${basis} - discounts${basis} + shipping${basis} + wrapping${basis}`,
      });
    }
  }
  const listedDiscountsIncl = payload.discounts.reduce(
    (sum, discount) => sum + thousandths(discount.amountTaxIncl),
    0,
  );
  if (Math.abs(listedDiscountsIncl - thousandths(totals.discountsTaxIncl)) > toleranceThousandths) {
    issues.push({ path: "discounts", message: "La somme des remises TTC doit correspondre à totals.discountsTaxIncl" });
  }
  if (order.isPaid && totals.totalPaid != null && thousandths(totals.totalPaid) === 0) {
    issues.push({ path: "totals.totalPaid", message: "Une commande payée doit avoir un montant payé" });
  }

  if (issues.length > 0) {
    throw new PayloadConsistencyError(issues);
  }

  const shopTimbreMinor =
    payload.timbreFiscal && thousandths(payload.timbreFiscal.amount) > 0
      ? toCurrencyMinor(payload.timbreFiscal.amount, currency)
      : null;
  if (shopTimbreMinor != null && shopTimbreMinor > toCurrencyMinor(totals.productsTaxIncl, currency)) {
    throw new PayloadConsistencyError([
      { path: "timbreFiscal.amount", message: "Le timbre doit être inclus dans totals.productsTaxIncl" },
    ]);
  }

  // --- Lines ---------------------------------------------------------------
  // Lines use the VAT-inclusive (TTC) basis: PrestaShop computes line totals from
  // unit_price_tax_incl, and the invoice engine preserves TTC-entered prices.
  // With a VAT override, the TTC paid is kept and HT is derived from that rate.
  const vatRateOverride =
    payload.invoiceOptions?.vatRate != null ? Number(payload.invoiceOptions.vatRate) : null;
  const effectiveRate = (rate: string) => vatRateOverride ?? Number(rate);
  /** HT (thousandths) contained in a TTC amount at the given rate. */
  const htFromTTC = (ttcThousandths: number, rate: number) =>
    calculateDocumentPrices(ttcThousandths, "TTC", rate).priceHTCents;
  type Line = InvoiceInput["lines"][number];
  const lines: Line[] = [];
  const pushChargeLine = (
    description: string,
    quantity: number,
    amountTaxExcl: string,
    amountTaxIncl: string,
    rate: string,
    discountThousandths = 0,
  ) => {
    const vatRate = effectiveRate(rate);
    const ttcThousandths = thousandths(amountTaxIncl);
    const unitPriceTTCCents = thousandthsToDocumentMinor(ttcThousandths, currency);
    const unitPriceHTCents = thousandthsToDocumentMinor(
      vatRateOverride == null ? thousandths(amountTaxExcl) : htFromTTC(ttcThousandths, vatRate),
      currency,
    );
    lines.push({
      productId: null,
      description,
      quantity,
      unit: "unité",
      unitPriceHTCents,
      unitPriceTTCCents,
      vatRate,
      discountRate: null,
      discountAmountCents:
        discountThousandths > 0 ? thousandthsToDocumentMinor(discountThousandths, currency) : null,
      fodecRate: null,
      position: lines.length,
    });
  };

  for (const line of payload.lines) {
    const description = line.reference ? `${line.name} (Réf. ${line.reference})` : line.name;
    pushChargeLine(
      description.length >= 2 ? description : `Article ${line.name}`,
      line.quantity,
      line.unitPriceTaxExcl,
      line.unitPriceTaxIncl,
      line.taxRate,
    );
  }

  // Free-shipping cart rules are applied to the shipping line itself so the
  // VAT of the discount follows the carrier's rate, as PrestaShop does.
  // Discounts are HT amounts in the invoice engine. With a VAT override, the
  // discount actually granted (TTC) is converted at the chosen rate.
  const discountHT = (discount: PrestashopOrderPayload["discounts"][number]) =>
    vatRateOverride == null
      ? thousandths(discount.amountTaxExcl)
      : htFromTTC(thousandths(discount.amountTaxIncl), vatRateOverride);
  let remainingDiscount =
    vatRateOverride == null ? discountsExcl : payload.discounts.reduce((sum, d) => sum + discountHT(d), 0);
  if (payload.shipping && shippingIncl > 0) {
    const freeShippingExcl = payload.discounts
      .filter((discount) => discount.freeShipping)
      .reduce((sum, discount) => sum + discountHT(discount), 0);
    const shippingHTThousandths = htFromTTC(shippingIncl, effectiveRate(payload.shipping.taxRate));
    const appliedToShipping = Math.min(freeShippingExcl, shippingHTThousandths, remainingDiscount);
    remainingDiscount -= appliedToShipping;
    pushChargeLine(
      payload.shipping.carrierName
        ? `Frais de livraison – ${payload.shipping.carrierName}`
        : "Frais de livraison",
      1,
      payload.shipping.amountTaxExcl,
      payload.shipping.amountTaxIncl,
      payload.shipping.taxRate,
      appliedToShipping,
    );
  }
  if (payload.wrapping && wrappingIncl > 0) {
    pushChargeLine(
      "Emballage cadeau",
      1,
      payload.wrapping.amountTaxExcl,
      payload.wrapping.amountTaxIncl,
      payload.wrapping.taxRate,
    );
  }

  // --- Notes ---------------------------------------------------------------
  const orderDate = new Date(order.createdAt);
  const noteParts = [
    // Only the customer-facing order reference: the internal PrestaShop id never appears.
    `Référence de commande : ${order.reference} du ${DATE_FORMATTER.format(orderDate)}.`,
    `Mode de paiement : ${order.paymentMethod}.`,
  ];
  if (payload.discounts.length > 0) {
    noteParts.push(`Remises : ${payload.discounts.map((discount) => discount.name).join(", ")}.`);
  }
  if (vatRateOverride != null) {
    noteParts.push(`TVA appliquée : ${vatRateOverride} % (montants TTC de la commande conservés).`);
  }

  const invoice: Omit<InvoiceInput, "clientId"> = {
    status: InvoiceStatus.ENVOYEE,
    reference: order.reference,
    issueDate: new Date(),
    dueDate: null,
    currency,
    globalDiscountRate: null,
    globalDiscountAmountCents:
      remainingDiscount > 0 ? thousandthsToDocumentMinor(remainingDiscount, currency) : null,
    notes: noteParts.join("\n"),
    terms: null,
    lateFeeRate: null,
    lines,
    // A timbre charged at checkout is always carried by the invoice (the customer
    // paid it); otherwise the integration setting decides.
    taxes: { applyFodec: false, applyTimbre: shopTimbreMinor != null || options.applyTimbre },
  };

  // --- Client --------------------------------------------------------------
  const company = billingAddress.company ?? customer.company;
  const contact: ClientContactInput = {
    name: joinName(billingAddress.firstName, billingAddress.lastName),
    email: customer.email.toLowerCase(),
    phone: billingAddress.phoneMobile ?? billingAddress.phone ?? customer.phone,
    company,
    address: formatAddress(billingAddress),
    vatNumber: billingAddress.vatNumber ?? customer.vatNumber,
  };

  const payment =
    options.recordPayments && order.isPaid
      ? {
          amountMinor: toCurrencyMinor(totals.totalPaid ?? totals.totalTaxIncl, currency),
          date: new Date(order.paidAt ?? order.createdAt),
          method: order.paymentMethod,
          note: `Paiement de la commande en ligne ${order.reference}`,
        }
      : null;

  return {
    contact,
    clientMetadata: {
      source: "prestashop",
      shopId: payload.shop.id,
      customerId: customer.id ?? null,
    },
    invoice,
    // Compared with the invoice total WITHOUT its timbre: when the shop already
    // charged the timbre, it is part of the order total and is taken out here.
    expectedTotalTTCMinor: toCurrencyMinor(totals.totalTaxIncl, currency) - (shopTimbreMinor ?? 0),
    toleranceMinor: toCurrencyMinor(options.totalTolerance, currency),
    vatRateOverride,
    shopTimbreMinor,
    payment: payment && payment.amountMinor > 0 ? payment : null,
  };
}

/** Stable hash input: the parsed payload re-serialized in schema key order. */
export function canonicalPayloadJson(payload: PrestashopOrderPayload) {
  return JSON.stringify(payload);
}
