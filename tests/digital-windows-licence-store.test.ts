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

/** Fake 25-character keys (never real Microsoft keys). */
function windowsKey(index: number) {
  return `TSTWIN${String(index).padStart(19, "0")}`;
}

describeWithDb("Windows 11 Pro licences (Postgres)", () => {
  let tenantId: string;
  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(fs.readFileSync(MIGRATION, "utf8"));
    const user = await prisma.user.create({
      data: { email: `windows-licences-${suffix}@example.com`, passwordHash: "hashed", name: "Windows Licence Test" },
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

  it("imports 25-character keys only, separately from the Kaspersky stock", async () => {
    const summary = await importLicenceCodes({
      tenantId,
      actorUserId: tenantId,
      sku: WINDOWS_11_PRO_SKU,
      text: [
        windowsKey(1),
        windowsKey(2).replace(/(.{5})/g, "$1-").slice(0, 29),
        "VK7JG-NPHTM-C97JM-9MPGT-3V66T", // public generic key: refused
        "ABCDE12345FGHIJ67890", // Kaspersky-shaped: refused
      ].join("\n"),
      batchLabel: "Test Windows",
    });
    expect(summary).toMatchObject({ imported: 2, alreadyStored: 0, invalidLines: [3, 4] });

    await importLicenceCodes({ tenantId, actorUserId: tenantId, sku: KASPERSKY_SKU, text: "TSTK0000000000000001" });

    const windows = await getDigitalProductInventory(tenantId, "windows");
    expect(windows).toHaveLength(1);
    expect(windows[0].counts).toMatchObject({ AVAILABLE: 2, RESERVED: 0, USED: 0 });
    const kaspersky = await getKasperskyInventory(tenantId);
    expect(kaspersky.find((row) => row.variant.sku === KASPERSKY_SKU)?.counts.AVAILABLE).toBe(1);
    expect(kaspersky.some((row) => row.variant.sku === WINDOWS_11_PRO_SKU)).toBe(false);
  });

  it("allocates a key, renders the Windows document and burns the key", async () => {
    const result = await requestLicenceDocument({
      tenantId,
      request: parseLicenceRequest({
        sku: WINDOWS_11_PRO_SKU,
        quantity: 1,
        customerName: "Client Test",
        customerEmail: "client.test@example.com",
        orderReference: "WINTEST01",
      }),
      idempotencyKey: `api:ps-1-9001-1-${suffix}`,
      source: "PRESTASHOP",
      actor: "api:test",
      external: { source: "prestashop", orderId: `9001-${suffix}`, lineId: "1" },
    });
    expect(result.kind).toBe("created");

    const { order, filename } = await renderLicenceOrderPdf({ tenantId, orderId: result.order.id, actor: "api:test" });
    expect(order.status).toBe("GENERATED");
    expect(filename).toBe("WIN11CWINTEST01.pdf");
    const html = rendered.html.at(-1)!;
    expect(html).toContain("Windows 11<span>Professionnel</span>");
    expect(html).toMatch(/TSTWI-N0000-00000-00000-0000[12]/);
    expect(html).not.toMatch(/WINTEST01|LIC-|Commande :|Client/);

    const [inventory] = await getDigitalProductInventory(tenantId, "windows");
    expect(inventory.counts).toMatchObject({ AVAILABLE: 1, USED: 1 });

    // Replaying the same order line returns the same licence, no new allocation.
    const replay = await requestLicenceDocument({
      tenantId,
      request: parseLicenceRequest({
        sku: WINDOWS_11_PRO_SKU,
        quantity: 1,
        customerName: "Client Test",
        customerEmail: "client.test@example.com",
        orderReference: "WINTEST01",
      }),
      idempotencyKey: `api:ps-1-9001-1-${suffix}`,
      source: "PRESTASHOP",
      actor: "api:test",
      external: { source: "prestashop", orderId: `9001-${suffix}`, lineId: "1" },
    });
    expect(replay).toMatchObject({ kind: "existing", order: { id: result.order.id } });
  });

  it("reports insufficient Windows stock without touching Kaspersky codes", async () => {
    await expect(
      requestLicenceDocument({
        tenantId,
        request: parseLicenceRequest({ sku: WINDOWS_11_PRO_SKU, quantity: 2 }),
        idempotencyKey: `manual:${suffix}-too-many`,
        source: "MANUAL",
        actor: "user:test",
      }),
    ).rejects.toBeInstanceOf(InsufficientLicenceStockError);
    const kaspersky = await getKasperskyInventory(tenantId);
    expect(kaspersky.find((row) => row.variant.sku === KASPERSKY_SKU)?.counts.AVAILABLE).toBe(1);
  });

  it("keeps each product's lists separate in the admin sections", async () => {
    const windowsSkus = [WINDOWS_11_PRO_SKU];
    const kasperskySkus = (await getKasperskyInventory(tenantId)).map((row) => row.variant.sku);

    const windowsOrders = await listLicenceOrders({ tenantId, productSkus: windowsSkus, page: 1, pageSize: 10 });
    expect(windowsOrders.total).toBe(1);
    const kasperskyOrders = await listLicenceOrders({ tenantId, productSkus: kasperskySkus, page: 1, pageSize: 10 });
    expect(kasperskyOrders.total).toBe(0);

    const windowsCodes = await listLicenceCodes({ tenantId, productSkus: windowsSkus, page: 1, pageSize: 10 });
    expect(windowsCodes.items.every((code) => code.productSku === WINDOWS_11_PRO_SKU)).toBe(true);
    expect(windowsCodes.total).toBe(2);

    const windowsEvents = await listLicenceEvents({ tenantId, productSkus: windowsSkus, limit: 50 });
    expect(windowsEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["CODES_IMPORTED", "ORDER_CREATED", "PDF_GENERATED"]),
    );
    const kasperskyEvents = await listLicenceEvents({ tenantId, productSkus: kasperskySkus, limit: 50 });
    expect(kasperskyEvents.map((event) => event.type)).toEqual(["CODES_IMPORTED"]);
    expect(await listLicenceOrders({ tenantId, productSkus: [], page: 1, pageSize: 10 })).toMatchObject({ total: 0 });
  });
});
