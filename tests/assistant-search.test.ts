import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SearchToken } from "@/server/assistant/search";

type SearchModule = typeof import("@/server/assistant/search");
type ClientCandidate = Parameters<SearchModule["scoreClientCandidate"]>[0];
type ProductCandidate = Parameters<SearchModule["scoreProductCandidate"]>[0];

let normalizeSearchText: SearchModule["normalizeSearchText"];
let tokenizeSearchQuery: SearchModule["tokenizeSearchQuery"];
let scoreClientCandidate: SearchModule["scoreClientCandidate"];
let scoreProductCandidate: SearchModule["scoreProductCandidate"];
let searchProductsForAssistant: SearchModule["searchProductsForAssistant"];

const CLIENT_SAMPLE: ClientCandidate = {
  id: "client_1",
  displayName: "ACME - Paris",
  companyName: "ACME Société",
  email: "factures@acme.com",
  phone: "+33 6 11 22 33 44",
  vatNumber: "TN1234567",
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

const PRODUCT_SAMPLE: ProductCandidate = {
  id: "prod_1",
  name: "Audit SEO avancé",
  sku: "SEO-2024",
  description: "Audit complet SEO et recommandations",
  category: "Services",
  unit: "Prestation",
  priceHTCents: 150000,
  priceTTCCents: 178500,
  vatRate: 19,
  updatedAt: new Date("2024-01-05T00:00:00.000Z"),
};

const PRODUCT_FIXTURES: ProductCandidate[] = [
  {
    id: "prod_host_basic",
    name: "Hébergement Basic",
    sku: "HOST-100",
    description: "Starter",
    category: "Hosting",
    unit: "unité",
    priceHTCents: 12000,
    priceTTCCents: 14400,
    vatRate: 20,
    updatedAt: new Date("2024-02-01T00:00:00.000Z"),
  },
  {
    id: "prod_host_plus",
    name: "Hébergement Basic Plus",
    sku: "HOST-101",
    description: "Starter plus",
    category: "Hosting",
    unit: "unité",
    priceHTCents: 18000,
    priceTTCCents: 21600,
    vatRate: 20,
    updatedAt: new Date("2024-03-01T00:00:00.000Z"),
  },
  {
    id: "prod_seo",
    name: "Audit SEO avancé",
    sku: "SEO-2024",
    description: "Audit complet SEO et recommandations",
    category: "Services",
    unit: "Prestation",
    priceHTCents: 150000,
    priceTTCCents: 178500,
    vatRate: 19,
    updatedAt: new Date("2024-01-05T00:00:00.000Z"),
  },
  {
    id: "prod_seo_pack",
    name: "Audits SEO avancés",
    sku: "SEO-2024-BIS",
    description: "Audit récurrent",
    category: "Services",
    unit: "Prestation",
    priceHTCents: 145000,
    priceTTCCents: 172550,
    vatRate: 19,
    updatedAt: new Date("2024-01-04T00:00:00.000Z"),
  },
  {
    id: "prod_service_3d",
    name: "Service 3D",
    sku: "SERV-3D",
    description: "Prestation 3D",
    category: "Services",
    unit: "Prestation",
    priceHTCents: 9900,
    priceTTCCents: 11781,
    vatRate: 19,
    updatedAt: new Date("2024-04-01T00:00:00.000Z"),
  },
  {
    id: "prod_price_79",
    name: "Pack Découverte",
    sku: "PACK-079",
    description: "Offre à 79 TND",
    category: "Packs",
    unit: "unité",
    priceHTCents: 79000,
    priceTTCCents: 94010,
    vatRate: 19,
    updatedAt: new Date("2024-04-02T00:00:00.000Z"),
  },
  {
    id: "prod_price_near",
    name: "Pack Pro",
    sku: "PACK-080",
    description: "Offre à 80 TND",
    category: "Packs",
    unit: "unité",
    priceHTCents: 80000,
    priceTTCCents: 95200,
    vatRate: 19,
    updatedAt: new Date("2024-04-03T00:00:00.000Z"),
  },
  {
    id: "prod_cafe",
    name: "Café en grains premium",
    sku: "CAFE-001",
    description: "Café torréfié artisanal",
    category: "Epicerie",
    unit: "kg",
    priceHTCents: 2500,
    priceTTCCents: 2675,
    vatRate: 7,
    updatedAt: new Date("2023-12-12T00:00:00.000Z"),
  },
  {
    id: "prod_cafe_plural",
    name: "Cafés moulus",
    sku: "CAFE-PLUR",
    description: "Moulu fin",
    category: "Epicerie",
    unit: "kg",
    priceHTCents: 2600,
    priceTTCCents: 2782,
    vatRate: 7,
    updatedAt: new Date("2023-12-20T00:00:00.000Z"),
  },
];

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) {
    vi.stubEnv(
      "TEST_DATABASE_URL",
      "postgresql://stub:stub@localhost:5432/testdb",
    );
  }
  const module = await import("@/server/assistant/search");
  normalizeSearchText = module.normalizeSearchText;
  tokenizeSearchQuery = module.tokenizeSearchQuery;
  scoreClientCandidate = module.scoreClientCandidate;
  scoreProductCandidate = module.scoreProductCandidate;
  searchProductsForAssistant = module.searchProductsForAssistant;
});

describe("assistant search helpers", () => {
  it("normalizes diacritics and punctuation", () => {
    expect(normalizeSearchText(" École---Test  ")).toBe("ecole test");
  });

  it("tokenizes text, digits and email parts", () => {
    const tokens = tokenizeSearchQuery(
      "ACME Paris 06 11 22 33 factures@acme.com",
    );
    const kinds = tokens.map((token) => token.kind);
    expect(kinds).toContain("text");
    expect(kinds).toContain("digits");
    expect(kinds).toContain("email");
    expect(tokens.some((token) => token.value.includes("acme paris"))).toBe(
      true,
    );
  });

  it("scores client matches even when punctuation differs", () => {
    const tokens = tokenizeSearchQuery("Acme Paris");
    const score = scoreClientCandidate(CLIENT_SAMPLE, tokens);
    expect(score.confidence).toBeGreaterThan(0.5);
    expect(score.matchFields).toContain("displayName");
  });

  it("scores client matches on phone digits", () => {
    const digitsOnly: SearchToken[] = [{ kind: "digits", value: "6112233" }];
    const score = scoreClientCandidate(CLIENT_SAMPLE, digitsOnly);
    expect(score.confidence).toBeGreaterThan(0.2);
    expect(score.matchFields).toContain("phone");
  });

  it("scores products on SKU and name", () => {
    const tokens = tokenizeSearchQuery("seo 2024");
    const score = scoreProductCandidate(PRODUCT_SAMPLE, tokens);
    expect(score.confidence).toBeGreaterThan(0.5);
    expect(score.matchFields).toContain("sku");
  });
});

describe("assistant product search", () => {
  it("returns only exact name match and flags it", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "Audit SEO avancé",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe("prod_seo");
    expect(result.bestConfidence).toBe(1);
  });

  it("returns only exact SKU match even with close names", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "HOST-101",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe("prod_host_plus");
    expect(result.bestConfidence).toBe(1);
  });

  it("prefers exact SKU matches even with similar names", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "HOST-100",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.matches[0]?.id).toBe("prod_host_basic");
    expect(result.matches[0]?.matchFields).toContain("sku");
    expect(result.hasExactMatch).toBe(true);
    expect(result.bestConfidence).toBe(1);
  });

  it("matches partial names without accents and ranks closer variants first", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "hebergement basic",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.matches[0]?.id).toBe("prod_host_basic");
    expect(result.matches).toHaveLength(1);
    expect(result.bestConfidence).toBe(1);
    expect(result.hasExactMatch).toBe(true);
  });

  it("detects exact name mention inside a longer sentence and short-circuits", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "y a t-il le produit service 3d",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe("prod_service_3d");
    expect(result.bestConfidence).toBe(1);
  });

  it("handles plural and accented queries for catalog items", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "cafes grains",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    const matchIds = result.matches.map((item) => item.id);
    expect(matchIds).toContain("prod_cafe");
    expect(result.matches[0]?.confidence).toBeGreaterThan(0.25);
    expect(result.hasExactMatch).toBe(false);
  });

  it("orders close SEO products deterministically", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "audit seo avance",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.matches[0]?.id).toBe("prod_seo");
    expect(result.matches).toHaveLength(1);
    expect(result.bestConfidence).toBe(1);
    expect(result.hasExactMatch).toBe(true);
  });

  it("uses price hints to prioritize close prices when provided", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "cafe 25 €",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.matches[0]?.id).toBe("prod_cafe");
    expect(result.bestConfidence).toBeGreaterThan(0.35);
  });

  it("finds the exact product by HT price in French phrasing", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "y a-t-il un produit à 79 DT",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe("prod_price_79");
    expect(result.matches[0]?.matchFields).toContain("price");
    expect(result.bestConfidence).toBe(1);
  });

  it("detects prices even when the currency is stuck to the number", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "peux-tu trouver un produit a 79dt",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches[0]?.id).toBe("prod_price_79");
    expect(result.matches[0]?.matchFields).toContain("price");
  });

  it("ignores unrelated numbers and still uses the price hint", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "12:29 y a-t-il un produit à 79 DT",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches[0]?.id).toBe("prod_price_79");
    expect(result.matches[0]?.matchFields).toContain("price");
  });

  it("handles prefixed metadata before the price question", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "Vous 12:33 y a-t-il un produit à 79 DT",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches[0]?.id).toBe("prod_price_79");
    expect(result.matches[0]?.matchFields).toContain("price");
  });

  it("returns only the exact price match when explicitly requested", async () => {
    const result = await searchProductsForAssistant(
      "user_1",
      "as-tu un produit à 79 tnd ?",
      5,
      { candidates: PRODUCT_FIXTURES },
    );
    expect(result.hasExactMatch).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe("prod_price_79");
    expect(result.matches[0]?.matchFields).toContain("price");
    expect(result.bestConfidence).toBe(1);
  });
});
