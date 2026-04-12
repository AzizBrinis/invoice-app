import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.fn();
const findManyMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: transactionMock,
    client: {
      findMany: findManyMock,
      create: createMock,
      update: updateMock,
    },
  },
}));

function buildClientRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client-1",
    displayName: "Client Import",
    companyName: null,
    address: null,
    email: null,
    phone: null,
    vatNumber: null,
    notes: null,
    isActive: true,
    source: "MANUAL",
    leadMetadata: null,
    ...overrides,
  };
}

describe("client CSV import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-parent",
      activeTenantId: "tenant-active",
    });
    transactionMock.mockReset();
  });

  it("imports new clients into the active tenant context", async () => {
    const { importClientsFromCsv } = await import("@/server/client-import");
    findManyMock.mockResolvedValue([]);
    createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      buildClientRecord({
        id: "client-created",
        displayName: data.displayName,
        companyName: data.companyName ?? null,
        address: data.address ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        vatNumber: data.vatNumber ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive ?? true,
        source: data.source ?? "IMPORT",
      }),
    );

    const summary = await importClientsFromCsv(
      "Nom;Société;E-mail;Téléphone;TVA;Adresse;Statut;Notes\n" +
        "Sophie Ben Salah;Atlas Conseil;SOPHIE@ATLAS.TN;+216 22 333 444;TN1234567A;Tunis;Actif;Client importé",
    );

    expect(requireUserMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId: "tenant-active" },
      select: expect.any(Object),
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "tenant-active",
          displayName: "Sophie Ben Salah",
          email: "sophie@atlas.tn",
          source: "IMPORT",
        }),
      }),
    );
    expect(transactionMock).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      totalRows: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      duplicateCount: 0,
      validationErrorCount: 0,
    });
  });

  it("updates an existing client by email without clearing missing fields", async () => {
    const { importClientsFromCsv } = await import("@/server/client-import");
    findManyMock.mockResolvedValue([
      buildClientRecord({
        id: "client-existing",
        displayName: "Bob Martin",
        email: "bob@example.com",
        address: "Ancienne adresse",
        notes: "Notes internes",
        source: "MANUAL",
        leadMetadata: { source: "legacy" },
      }),
    ]);
    updateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      buildClientRecord({
        id: "client-existing",
        displayName: data.displayName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        notes: data.notes,
        source: data.source,
        leadMetadata: data.leadMetadata ?? { source: "legacy" },
      }),
    );

    const summary = await importClientsFromCsv(
      "Nom;E-mail;Téléphone\nBob Martin;bob@example.com;+216 11 222 333",
      "tenant-explicit",
    );

    expect(requireUserMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "client-existing" },
        data: expect.objectContaining({
          userId: "tenant-explicit",
          displayName: "Bob Martin",
          email: "bob@example.com",
          phone: "+216 11 222 333",
          address: "Ancienne adresse",
          notes: "Notes internes",
          source: "MANUAL",
        }),
      }),
    );
    expect(summary).toMatchObject({
      createdCount: 0,
      updatedCount: 1,
      skippedCount: 0,
    });
  });

  it("reports duplicate and invalid rows while importing valid ones", async () => {
    const { importClientsFromCsv } = await import("@/server/client-import");
    findManyMock.mockResolvedValue([]);
    createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      buildClientRecord({
        id: "client-created",
        displayName: data.displayName,
        email: data.email,
        source: data.source ?? "IMPORT",
      }),
    );

    const summary = await importClientsFromCsv(
      "Nom;E-mail;Statut\n" +
        "Alpha;alpha@example.com;Actif\n" +
        "Alpha Bis;alpha@example.com;Actif\n" +
        "Beta;not-an-email;Actif",
      "tenant-explicit",
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      totalRows: 3,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 2,
      duplicateCount: 1,
      validationErrorCount: 1,
    });
    expect(summary.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rowNumber: 3,
          message: "ligne dupliquee dans le fichier",
        }),
        expect.objectContaining({
          rowNumber: 4,
          message: "E-mail invalide",
        }),
      ]),
    );
  });

  it("skips ambiguous name-only matches to avoid unsafe duplicates", async () => {
    const { importClientsFromCsv } = await import("@/server/client-import");
    findManyMock.mockResolvedValue([
      buildClientRecord({
        id: "client-existing",
        displayName: "Maison Noura",
      }),
    ]);

    const summary = await importClientsFromCsv(
      "Nom\nMaison Noura",
      "tenant-explicit",
    );

    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(summary).toMatchObject({
      totalRows: 1,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 1,
      duplicateCount: 1,
    });
    expect(summary.issues[0]).toMatchObject({
      rowNumber: 2,
      message:
        "client potentiellement deja present (ajoutez un e-mail, telephone ou numero TVA pour lever l'ambiguite)",
    });
  });
});
