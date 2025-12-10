import { beforeAll, describe, expect, it } from "vitest";

const baseQuotePayload = {
  clientId: "client_1",
  issueDate: "2024-04-01",
  validUntil: "2024-04-15",
  currency: "TND",
  lines: [
    {
      description: "Prestation",
      quantity: 1,
      unit: "unite",
      unitPrice: 100,
      vatRate: 19,
    },
  ],
};

let normalizeToolInput: typeof import("@/server/assistant/orchestrator").normalizeToolInput;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) {
    process.env.TEST_DATABASE_URL = "postgresql://stub:stub@localhost:5432/testdb";
  }
  ({ normalizeToolInput } = await import("@/server/assistant/orchestrator"));
});

describe("assistant timbre handling for quotes", () => {
  it("keeps timbre enabled by default", () => {
    const normalized = normalizeToolInput("create_quote", baseQuotePayload, {
      lastUserMessage: "Cree un devis classique",
    }) as any;
    expect(normalized.applyTimbre).toBe(true);
  });

  it("disables timbre when the user opts out explicitly", () => {
    const normalized = normalizeToolInput("create_quote", baseQuotePayload, {
      lastUserMessage: "Fais-moi un devis sans timbre fiscal",
    }) as any;
    expect(normalized.applyTimbre).toBe(false);
  });

  it("lets explicit user intent override provided applyTimbre hints", () => {
    const normalized = normalizeToolInput(
      "create_quote",
      { ...baseQuotePayload, applyTimbre: true },
      { lastUserMessage: "merci de ne pas appliquer le timbre" },
    ) as any;
    expect(normalized.applyTimbre).toBe(false);
  });

  it("keeps the opt-out even when the latest message omits it", () => {
    const normalized = normalizeToolInput(
      "create_quote",
      { ...baseQuotePayload, applyTimbre: true },
      { lastUserMessage: "ajoute une remise", timbrePreference: false },
    ) as any;
    expect(normalized.applyTimbre).toBe(false);
  });
});
