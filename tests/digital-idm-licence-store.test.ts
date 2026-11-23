import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const rendered = vi.hoisted(() => ({ html: [] as string[] }));
vi.mock("@/server/pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/pdf")>()),
  renderPdfFromHtml: vi.fn(async (html: string) => {
    rendered.html.push(html);
    return Buffer.from("%PDF-1.7 test");
  }),
}));

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db/prisma-server";
import { IDM_ANNUAL_SKU, IDM_LIFETIME_SKU } from "@/lib/digital-products/idm-catalog";
import { WINDOWS_11_PRO_SKU } from "@/lib/digital-products/windows-catalog";
import {
  getDigitalProductInventory,
  getKasperskyInventory,
  importLicenceCodes,
  parseLicenceRequest,
  renderLicenceOrderPdf,
  requestLicenceDocument,
} from "@/server/digital-products/licences";
import {
  InsufficientLicenceStockError,
  listLicenceCodes,
  listLicenceEvents,
  listLicenceOrders,
} from "@/server/digital-products/store";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const MIGRATION = path.resolve(process.cwd(), "scripts/sql/20261110_digital_licences.sql");
const KASPERSKY_SKU = "kaspersky-plus-1p-1y";

/** Fake 20-character serials (never real IDM serials). */
function idmSerial(index: number) {
  return `TSTIDM${String(index).padStart(14, "0")}`;
}

describeWithDb("IDM licences (Postgres)", () => {
  let tenantId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(fs.readFileSync(MIGRATION, "utf8"));
    const user = await prisma.user.create({
      data: { email: `idm-licences-${suffix}@example.com`, passwordHash: "hashed", name: "IDM Licence Test" },
    });
    tenantId = user.id;
  });

  afterAll(async () => {
    if (!tenantId) return;
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceEvent" WHERE "userId" = ${tenantId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceCode" WHERE "userId" = ${tenantId}`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "DigitalLicenceOrder" WHERE "userId" = ${tenantId}`);
    await prisma.user.delete({ where: { id: tenantId } });
  });

  it("imports 20-character serials per plan, separately from the other products", async () => {
    const summary = await importLicenceCodes({
      tenantId,
      actorUserId: tenantId,
      sku: IDM_ANNUAL_SKU,
      text: [
        idmSerial(1),
        idmSerial(2).replace(/(.{5})/g, "$1-").slice(0, 23),
        "BCDFGHJKMPQRTVWXY2346789B", // Windows-shaped (25): refused
        "SHORT-KEY",
      ].join("\n"),
      batchLabel: "Test IDM",
    });
    expect(summary).toMatchObject({ imported: 2, alreadyStored: 0, invalidLines: [3, 4] });

    await importLicenceCodes({ tenantId, actorUserId: tenantId, sku: IDM_LIFETIME_SKU, text: idmSerial(3) });
    await importLicenceCodes({ tenantId, actorUserId: tenantId, sku: KASPERSKY_SKU, text: "TSTK0000000000000001" });
    // The same serial cannot be stored twice, even under another SKU.
    const again = await importLicenceCodes({ tenantId, actorUserId: tenantId, sku: KASPERSKY_SKU, text: idmSerial(1) });
    expect(again).toMatchObject({ imported: 0, alreadyStored: 1 });

    const idm = await getDigitalProductInventory(tenantId, "idm");
    expect(idm.map((row) => [row.variant.sku, row.counts.AVAILABLE])).toEqual([
      [IDM_ANNUAL_SKU, 2],
      [IDM_LIFETIME_SKU, 1],
    ]);
    const kaspersky = await getKasperskyInventory(tenantId);
    expect(kaspersky.find((row) => row.variant.sku === KASPERSKY_SKU)?.counts.AVAILABLE).toBe(1);
    const windows = await getDigitalProductInventory(tenantId, "windows");
    expect(windows[0].counts.AVAILABLE).toBe(0);
  });

  it("allocates a serial, renders the IDM certificate and burns the serial", async () => {
    const result = await requestLicenceDocument({
      tenantId,
      request: parseLicenceRequest({
        sku: IDM_ANNUAL_SKU,
        quantity: 1,
        customerName: "Client Test",
        customerEmail: "client.test@example.com",
        orderReference: "IDMTEST01",
      }),
      idempotencyKey: `api:ps-1-9101-1-${suffix}`,
      source: "PRESTASHOP",
      actor: "api:test",
      external: { source: "prestashop", orderId: `9101-${suffix}`, lineId: "1" },
    });
    expect(result.kind).toBe("created");

    const { order, filename } = await renderLicenceOrderPdf({ tenantId, orderId: result.order.id, actor: "api:test" });
    expect(order.status).toBe("GENERATED");
    expect(filename).toBe(`licence-idm-1p-1y-${order.number}.pdf`);
    const html = rendered.html.at(-1)!;
    expect(html).toContain("Internet Download</span><span>Manager");
    expect(html).toContain("1 an · 1 PC");
    expect(html).toMatch(/TSTID-M0000-00000-0000[12]/);
    expect(html).toContain("IDMTEST01");
    expect(html).toContain("Client Test");

    const [annual, lifetime] = await getDigitalProductInventory(tenantId, "idm");
    expect(annual.counts).toMatchObject({ AVAILABLE: 1, USED: 1 });
    expect(lifetime.counts).toMatchObject({ AVAILABLE: 1, USED: 0 });

    // Replaying the same order line returns the same licence, no new allocation.
    const replay = await requestLicenceDocument({
      tenantId,
      request: parseLicenceRequest({
        sku: IDM_ANNUAL_SKU,
        quantity: 1,
        customerName: "Client Test",
        customerEmail: "client.test@example.com",
        orderReference: "IDMTEST01",
      }),
      idempotencyKey: `api:ps-1-9101-1-${suffix}`,
      source: "PRESTASHOP",
      actor: "api:test",
      external: { source: "prestashop", orderId: `9101-${suffix}`, lineId: "1" },
    });
    expect(replay).toMatchObject({ kind: "existing", order: { id: result.order.id } });
  });

  it("reports insufficient IDM stock without touching the other plan or products", async () => {
    await expect(
      requestLicenceDocument({
        tenantId,
        request: parseLicenceRequest({ sku: IDM_LIFETIME_SKU, quantity: 2 }),
        idempotencyKey: `manual:${suffix}-too-many`,
        source: "MANUAL",
        actor: "user:test",
      }),
    ).rejects.toBeInstanceOf(InsufficientLicenceStockError);
    const kaspersky = await getKasperskyInventory(tenantId);
    expect(kaspersky.find((row) => row.variant.sku === KASPERSKY_SKU)?.counts.AVAILABLE).toBe(1);
    const [annual, lifetime] = await getDigitalProductInventory(tenantId, "idm");
    expect(annual.counts.AVAILABLE).toBe(1);
    expect(lifetime.counts).toMatchObject({ AVAILABLE: 1, RESERVED: 0 });
  });

  it("keeps each product's lists separate in the admin sections", async () => {
    const idmSkus = [IDM_ANNUAL_SKU, IDM_LIFETIME_SKU];
    const kasperskySkus = (await getKasperskyInventory(tenantId)).map((row) => row.variant.sku);

    const idmOrders = await listLicenceOrders({ tenantId, productSkus: idmSkus, page: 1, pageSize: 10 });
    expect(idmOrders.total).toBe(1);
    const kasperskyOrders = await listLicenceOrders({ tenantId, productSkus: kasperskySkus, page: 1, pageSize: 10 });
    expect(kasperskyOrders.total).toBe(0);

    const idmCodes = await listLicenceCodes({ tenantId, productSkus: idmSkus, page: 1, pageSize: 10 });
    expect(idmCodes.items.every((code) => idmSkus.includes(code.productSku))).toBe(true);
    expect(idmCodes.total).toBe(3);

    const idmEvents = await listLicenceEvents({ tenantId, productSkus: idmSkus, limit: 50 });
    expect(idmEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["CODES_IMPORTED", "ORDER_CREATED", "PDF_GENERATED"]),
    );
    const kasperskyEvents = await listLicenceEvents({ tenantId, productSkus: kasperskySkus, limit: 50 });
    expect(kasperskyEvents.map((event) => event.type)).toEqual(expect.arrayContaining(["CODES_IMPORTED"]));
    expect(kasperskyEvents.some((event) => event.type === "ORDER_CREATED")).toBe(false);
    const windowsOrders = await listLicenceOrders({ tenantId, productSkus: [WINDOWS_11_PRO_SKU], page: 1, pageSize: 10 });
    expect(windowsOrders.total).toBe(0);
    expect(await listLicenceOrders({ tenantId, productSkus: [], page: 1, pageSize: 10 })).toMatchObject({ total: 0 });
  });
});
