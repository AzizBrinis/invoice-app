import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-only modules that are irrelevant here.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

// Headless Chrome is replaced by a stub whose "PDF" is the HTML it was asked
// to print, so the test can assert what the real template rendered.
vi.mock("puppeteer", () => {
  const launch = async () => ({
    newPage: async () => {
      let html = "";
      return {
        setDefaultTimeout: () => {},
        setDefaultNavigationTimeout: () => {},
        setContent: async (content: string) => {
          html = content;
        },
        evaluate: async () => undefined,
        pdf: async () => Buffer.from(html, "utf8"),
        close: async () => {},
      };
    },
  });
  return { default: { launch }, launch };
});
vi.mock("@sparticuz/chromium", () => ({ default: { args: [], executablePath: async () => "" } }));

import { prisma } from "@/lib/db";
import { createInvoiceForUser, type InvoiceInput } from "@/server/invoices";
import { getSettings } from "@/server/settings";
import { invoiceNumberingYear } from "@/server/sequences";
import { loadPrestashopIntegrationConfig } from "@/server/integrations/prestashop/config";
import {
  handlePrestashopInvoiceDownload,
  handlePrestashopInvoiceRequest,
  type PrestashopInvoiceDeps,
} from "@/server/integrations/prestashop/service";
import { computeSignature, sha256Hex } from "@/server/integrations/prestashop/signature";

/**
 * End-to-end against a real Postgres database (TEST_DATABASE_URL): real
 * request store, client resolution, invoice numbering, invoice persistence,
 * payment recording and PDF template. Never point this at production.
 */
const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const KEY_ID = "e2e-key";
const SECRET = "e2e-secret-0123456789abcdef0123456789abcdef";
const PATH = "/api/integrations/prestashop/invoices";
const RUN = Date.now().toString(36);
const ORDER_DATE = new Date().toISOString();

function orderPayload(orderId: number) {
  return {
    schemaVersion: 1,
    shop: { id: 1, name: "Techno Smart" },
    order: {
      id: orderId,
      reference: `REF${orderId}`,
      createdAt: ORDER_DATE,
      currency: "TND",
      paymentMethod: "Paiement à la livraison",
      isPaid: false,
      paidAt: null,
    },
    customer: {
      id: 1000 + orderId,
      email: `customer-${orderId}-${RUN}@example.com`,
      firstName: "Amine",
      lastName: `Client ${orderId}`,
      company: null,
      vatNumber: null,
      phone: null,
    },
    billingAddress: {
      firstName: "Amine",
      lastName: `Client ${orderId}`,
      company: null,
      vatNumber: null,
      address1: "12 Rue de Marseille",
      address2: null,
      postcode: "1000",
      city: "Tunis",
      state: null,
      country: "Tunisie",
      countryIso: "TN",
      phone: null,
      phoneMobile: null,
    },
    lines: [
      {
        productId: 101,
        productAttributeId: 0,
        reference: "CASQ-X",
        name: "Casque Bluetooth X",
        quantity: 1,
        unitPriceTaxExcl: "100.000000",
        unitPriceTaxIncl: "119.000000",
        taxRate: "19.000",
      },
    ],
    shipping: null,
    wrapping: null,
    discounts: [],
    totals: {
      productsTaxExcl: "100.000000",
      productsTaxIncl: "119.000000",
      discountsTaxExcl: "0.000000",
      discountsTaxIncl: "0.000000",
      shippingTaxExcl: "0.000000",
      shippingTaxIncl: "0.000000",
      wrappingTaxExcl: "0.000000",
      wrappingTaxIncl: "0.000000",
      totalTaxExcl: "100.000000",
      totalTaxIncl: "119.000000",
    },
  };
}

function sign(method: string, path: string, body: string, idempotencyKey: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  return {
    "x-signature-key-id": KEY_ID,
    "x-signature-timestamp": timestamp,
    "x-signature-nonce": nonce,
    ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    "x-signature": computeSignature(SECRET, {
      method,
      path,
      timestamp,
      nonce,
      idempotencyKey,
      bodySha256Hex: sha256Hex(body),
    }),
  };
}

describeWithDb("PrestaShop invoice API end-to-end (Postgres)", () => {
  const suffix = Date.now().toString(36);
  const year = invoiceNumberingYear();
  const number = (n: number) => `FAC-${year}-${String(n).padStart(4, "0")}`;
  let tenantUserId: string;
  let deps: Partial<PrestashopInvoiceDeps>;

  const generate = async (orderId: number, idempotencyKey = `ps-1-${orderId}-${suffix}`) => {
    const body = JSON.stringify(orderPayload(orderId));
    const response = await handlePrestashopInvoiceRequest(
      new Request(`https://invoices.example.com${PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...sign("POST", PATH, body, idempotencyKey) },
        body,
      }),
      deps,
    );
    return { status: response.status, body: await response.json() };
  };

  const download = async (orderId: number) => {
    const path = `${PATH}/1/${orderId}`;
    const response = await handlePrestashopInvoiceDownload(
      new Request(`https://invoices.example.com${path}`, { method: "GET", headers: sign("GET", path, "", "") }),
      { shopId: "1", orderId: String(orderId) },
      deps,
    );
    const body = await response.json();
    return { status: response.status, html: Buffer.from(body.pdf?.base64 ?? "", "base64").toString("utf8"), body };
  };

  const manualInvoice = async () => {
    const client = await prisma.client.create({
      data: { userId: tenantUserId, displayName: "Client comptoir", email: `walkin-${suffix}-${Math.random()}@example.com` },
    });
    return createInvoiceForUser(tenantUserId, {
      clientId: client.id,
      status: "BROUILLON",
      issueDate: new Date(),
      currency: "TND",
      lines: [{ productId: null, description: "Prestation", quantity: 1, unit: "unité", unitPriceHTCents: 10000, vatRate: 19, position: 0 }],
    } as InvoiceInput);
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `prestashop-e2e-${suffix}@example.com`, passwordHash: "hashed", name: "E2E tenant" },
    });
    tenantUserId = user.id;
    await getSettings(tenantUserId); // initialises Paramètres généraux with defaults
    await prisma.companySettings.update({
      where: { userId: tenantUserId },
      data: {
        companyName: "Techno Smart SARL",
        matriculeFiscal: "1111111/A/M/000",
        address: "Ancienne adresse, Tunis",
        invoiceNumberPrefix: "FAC",
        resetNumberingAnnually: true,
      },
    });
    deps = {
      loadConfig: () =>
        loadPrestashopIntegrationConfig({
          PRESTASHOP_INVOICE_TENANT_ID: tenantUserId,
          PRESTASHOP_INVOICE_API_KEYS: `${KEY_ID}:${SECRET}`,
          NODE_ENV: "test",
        }),
      random: () => 1,
      log: () => {},
      onInvoiceChanged: () => {},
    };
  });

  afterAll(async () => {
    if (!tenantUserId) return;
    await prisma.$executeRawUnsafe(`DELETE FROM "ExternalInvoiceRequest" WHERE "userId" = $1`, tenantUserId);
    await prisma.$executeRawUnsafe(`DELETE FROM "IntegrationRequestNonce" WHERE "keyId" = $1`, KEY_ID);
    await prisma.payment.deleteMany({ where: { userId: tenantUserId } });
    await prisma.invoice.deleteMany({ where: { userId: tenantUserId } });
    await prisma.client.deleteMany({ where: { userId: tenantUserId } });
    await prisma.numberingSequence.deleteMany({ where: { userId: tenantUserId } });
    await prisma.companySettings.deleteMany({ where: { userId: tenantUserId } });
    await prisma.messagingSettings.deleteMany({ where: { userId: tenantUserId } });
    await prisma.user.delete({ where: { id: tenantUserId } });
  });

  it("saves shop invoices in Factures, numbered by invoice-app with no gap", async () => {
    expect((await manualInvoice()).number).toBe(number(1));

    const first = await generate(101);
    expect(first.status).toBe(201);
    expect(first.body.invoice.number).toBe(number(2));

    // Second click on the same order: same invoice, no number consumed.
    const again = await generate(101, `ps-1-101-second-click-${suffix}`);
    expect(again.status).toBe(200);
    expect(again.body.invoice.number).toBe(number(2));

    // Rejected order (totals do not match): no number consumed.
    const bad = orderPayload(102);
    bad.totals.totalTaxIncl = "999.000000";
    bad.totals.totalTaxExcl = "880.000000";
    bad.totals.productsTaxIncl = "999.000000";
    bad.totals.productsTaxExcl = "880.000000";
    const badBody = JSON.stringify(bad);
    const rejected = await handlePrestashopInvoiceRequest(
      new Request(`https://invoices.example.com${PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...sign("POST", PATH, badBody, `ps-1-102-${suffix}`) },
        body: badBody,
      }),
      deps,
    );
    expect(rejected.status).toBe(422);

    expect((await generate(103)).body.invoice.number).toBe(number(3));
    expect((await manualInvoice()).number).toBe(number(4));
    expect((await generate(104)).body.invoice.number).toBe(number(5));

    // What the Factures page lists for this tenant.
    const listed = await prisma.invoice.findMany({
      where: { userId: tenantUserId },
      orderBy: { number: "asc" },
      select: { number: true, reference: true, status: true, timbreAmountCents: true, client: { select: { displayName: true } } },
    });
    expect(listed.map((invoice) => invoice.number)).toEqual([1, 2, 3, 4, 5].map(number));
    const shopInvoices = listed.filter((invoice) => invoice.reference?.startsWith("REF"));
    expect(shopInvoices.map((invoice) => invoice.reference)).toEqual(["REF101", "REF103", "REF104"]);
    expect(shopInvoices.every((invoice) => invoice.status === "ENVOYEE")).toBe(true);
    expect(shopInvoices[0].client.displayName).toBe("Amine Client 101");
  });

  it("always prints the current company details from Paramètres généraux", async () => {
    const before = await download(101);
    expect(before.status).toBe(200);
    expect(before.body.invoice.number).toBe(number(2));
    expect(before.html).toContain("Techno Smart SARL");
    expect(before.html).toContain("1111111/A/M/000");
    expect(before.html).toContain("Ancienne adresse, Tunis");

    // The company edits its details in Paramètres généraux.
    await prisma.companySettings.update({
      where: { userId: tenantUserId },
      data: {
        companyName: "Techno Smart SA",
        matriculeFiscal: "2222222/B/M/000",
        address: "Nouvelle adresse, Sousse",
        phone: "+216 70 000 000",
      },
    });

    const after = await download(101);
    expect(after.status).toBe(200);
    expect(after.body.invoice.number).toBe(number(2)); // same invoice, same number
    expect(after.html).toContain("Techno Smart SA");
    expect(after.html).not.toContain("Techno Smart SARL");
    expect(after.html).toContain("2222222/B/M/000");
    expect(after.html).toContain("Nouvelle adresse, Sousse");
    expect(after.html).not.toContain("Ancienne adresse");
    expect(after.html).toContain("+216 70 000 000");

    // A newly generated invoice uses the new details too.
    const fresh = await generate(105);
    expect(fresh.status).toBe(201);
    expect(Buffer.from(fresh.body.pdf.base64, "base64").toString("utf8")).toContain("Techno Smart SA");
  });
});
