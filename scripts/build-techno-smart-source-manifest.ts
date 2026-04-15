import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";

const SOURCE_SITE_URL = "https://techno-smart.tn/";
const SOURCE_SITEMAP_URL =
  "https://techno-smart.tn/sitemaps/shop_1/sitemap_shop_1_002.xml";
const OUTPUT_DIRECTORY = path.join(
  process.cwd(),
  "tmp",
  "imports",
  "techno-smart",
);
const OUTPUT_FILE = path.join(OUTPUT_DIRECTORY, "source-manifest.json");
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_ATTEMPTS = 2;
const CRAWL_CONCURRENCY = 3;
const REQUEST_USER_AGENT =
  "invoices-app-techno-smart-source-manifest/1.0 (+https://techno-smart.net)";

type ManifestOptionValue = {
  id: string | null;
  label: string;
  selected: boolean;
};

type ManifestOptionSelector = {
  groupId: string | null;
  name: string | null;
  inputType: "select" | "radio" | "checkbox";
  values: ManifestOptionValue[];
};

type ManifestSelectedAttribute = {
  attributeId: string | null;
  attributeGroupId: string | null;
  group: string | null;
  name: string | null;
};

type ManifestProductRecord = {
  sourceUrl: string;
  canonicalUrl: string | null;
  sourceFingerprint: string;
  pageTitle: string | null;
  meta: {
    title: string | null;
    description: string | null;
    brand: string | null;
  };
  product: {
    idProduct: number | null;
    name: string | null;
    linkRewrite: string | null;
    category: {
      slug: string | null;
      name: string | null;
    };
    quantity: number | null;
    availability: string | null;
    prices: {
      priceDisplay: string | null;
      priceAmount: number | null;
      priceTaxExcAmount: number | null;
      priceWithoutReductionAmount: number | null;
      reductionAmount: number | null;
      hasDiscount: boolean;
      specificPrices: unknown;
    };
    descriptions: {
      shortHtml: string | null;
      shortText: string | null;
      fullHtml: string | null;
      fullText: string | null;
    };
    imageUrls: {
      cover: string | null;
      gallery: string[];
      description: string[];
    };
    optionSelectors: ManifestOptionSelector[];
    selectedAttributes: ManifestSelectedAttribute[];
  };
};

type ManifestSkippedRecord = {
  sourceUrl: string;
  reason:
    | "fetch_failed"
    | "invalid_product_body"
    | "missing_data_product"
    | "invalid_data_product";
  message: string;
  canonicalUrl: string | null;
  bodyId: string | null;
  pageTitle: string | null;
  hasDataProduct: boolean;
};

type SourceManifest = {
  generatedAt: string;
  source: {
    siteUrl: string;
    sitemapUrl: string;
    crawlConcurrency: number;
  };
  summary: {
    sitemapUrlCount: number;
    validProductCount: number;
    skippedCount: number;
  };
  products: ManifestProductRecord[];
  skipped: ManifestSkippedRecord[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value: string | null | undefined) {
  const normalized = value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeHtmlFragment(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function parseOptionalNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseOptionalInteger(value: unknown) {
  const parsed = parseOptionalNumber(value);
  if (parsed == null) return null;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function parseBooleanLike(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function asAbsoluteUrl(value: string | null | undefined, baseUrl: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  });

  return normalized;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function parseSitemapLocs(xml: string) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
    .map((match) => cleanText(match[1]))
    .filter((value): value is string => Boolean(value));
}

function htmlToText(html: string | null) {
  if (!html) {
    return null;
  }
  const $ = load(`<div>${html}</div>`);
  return cleanText($.root().text());
}

function extractDescriptionImageUrls(
  shortHtml: string | null,
  fullHtml: string | null,
  baseUrl: string,
) {
  const urls: string[] = [];
  [shortHtml, fullHtml].forEach((html) => {
    if (!html) {
      return;
    }
    const $ = load(`<div>${html}</div>`);
    $("img[src]").each((_index, element) => {
      urls.push(asAbsoluteUrl($(element).attr("src"), baseUrl));
    });
  });
  return uniqueStrings(urls);
}

function resolveBestImageUrl(input: unknown, baseUrl: string) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const image = input as Record<string, unknown>;
  const bySize =
    image.bySize && typeof image.bySize === "object"
      ? (image.bySize as Record<string, unknown>)
      : null;

  const candidates = [
    bySize?.large_default,
    image.large,
    bySize?.home_default,
    bySize?.medium_default,
    image.medium,
    bySize?.small_default,
    image.small,
  ].flatMap((value) => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const url = (value as { url?: unknown }).url;
    return typeof url === "string" ? [url] : [];
  });

  return uniqueStrings(
    candidates.map((candidate) => asAbsoluteUrl(candidate, baseUrl)),
  )[0] ?? null;
}

function normalizeSelectorName(value: string | null | undefined) {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }
  const colonIndex = cleaned.indexOf(":");
  return colonIndex >= 0 ? cleanText(cleaned.slice(0, colonIndex)) : cleaned;
}

function parseSelectorGroupId(selectName: string | null | undefined) {
  const trimmed = selectName?.trim();
  if (!trimmed) {
    return null;
  }
  const match = /^group\[(\d+)\]$/i.exec(trimmed);
  return match?.[1] ?? null;
}

function parseOptionSelectors(html: string) {
  const $ = load(html);
  const selectors: ManifestOptionSelector[] = [];

  $(".product-variants .product-variants-item").each((_index, element) => {
    const item = $(element);
    const labelText =
      normalizeSelectorName(item.find(".control-label").first().text()) ??
      normalizeSelectorName(item.find("label").first().text());
    const select = item.find("select").first();

    if (select.length > 0) {
      const values = select
        .find("option")
        .toArray()
        .map((option) => {
          const elementValue = $(option);
          const label =
            cleanText(elementValue.text()) ??
            cleanText(elementValue.attr("title")) ??
            cleanText(elementValue.attr("value"));
          if (!label) {
            return null;
          }
          return {
            id: cleanText(elementValue.attr("value")),
            label,
            selected: elementValue.is("[selected]"),
          } satisfies ManifestOptionValue;
        })
        .filter((value): value is ManifestOptionValue => Boolean(value));

      if (values.length > 0) {
        selectors.push({
          groupId:
            cleanText(select.attr("data-product-attribute")) ??
            parseSelectorGroupId(select.attr("name")),
          name:
            labelText ??
            normalizeSelectorName(select.attr("aria-label")) ??
            normalizeSelectorName(select.attr("name")),
          inputType: "select",
          values,
        });
      }
      return;
    }

    const inputs = item.find("input[type='radio'], input[type='checkbox']");
    if (inputs.length === 0) {
      return;
    }

    const inputType = (inputs.first().attr("type") ?? "radio") as
      | "radio"
      | "checkbox";
    const values = inputs
      .toArray()
      .map((input) => {
        const elementValue = $(input);
        const inputId = cleanText(elementValue.attr("id"));
        const optionLabel =
          (inputId ? cleanText($(`label[for="${inputId}"]`).first().text()) : null) ??
          cleanText(elementValue.closest("label").text()) ??
          cleanText(elementValue.attr("title")) ??
          cleanText(elementValue.attr("value"));
        if (!optionLabel) {
          return null;
        }
        return {
          id: cleanText(elementValue.attr("value")),
          label: optionLabel,
          selected: elementValue.is("[checked]"),
        } satisfies ManifestOptionValue;
      })
      .filter((value): value is ManifestOptionValue => Boolean(value));

    if (values.length > 0) {
      selectors.push({
        groupId: null,
        name: labelText,
        inputType,
        values,
      });
    }
  });

  return selectors;
}

function parseSelectedAttributes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.values(value)
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const attribute = entry as Record<string, unknown>;
      return {
        attributeId: cleanText(
          typeof attribute.id_attribute === "string"
            ? attribute.id_attribute
            : `${attribute.id_attribute ?? ""}`,
        ),
        attributeGroupId: cleanText(
          typeof attribute.id_attribute_group === "string"
            ? attribute.id_attribute_group
            : `${attribute.id_attribute_group ?? ""}`,
        ),
        group: cleanText(
          typeof attribute.group === "string" ? attribute.group : null,
        ),
        name: cleanText(
          typeof attribute.name === "string" ? attribute.name : null,
        ),
      } satisfies ManifestSelectedAttribute;
    })
    .filter(
      (entry): entry is ManifestSelectedAttribute =>
        Boolean(entry && (entry.name || entry.group || entry.attributeId)),
    );
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(",")}}`;
}

function buildSourceFingerprint(product: ManifestProductRecord) {
  return createHash("sha256")
    .update(
      stableStringify({
        canonicalUrl: product.canonicalUrl,
        meta: product.meta,
        product: product.product,
      }),
    )
    .digest("hex");
}

async function fetchText(url: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          "accept-language": "fr-FR,fr;q=0.9,en;q=0.7",
          "user-agent": REQUEST_USER_AGENT,
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Unexpected HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(500 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unknown fetch failure.");
}

async function mapWithConcurrency<T, TResult>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(values.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        if (currentIndex >= values.length) {
          return;
        }
        results[currentIndex] = await mapper(values[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

async function inspectProductPage(sourceUrl: string) {
  let html = "";
  try {
    html = await fetchText(sourceUrl);
  } catch (error) {
    return {
      kind: "skipped" as const,
      record: {
        sourceUrl,
        reason: "fetch_failed" as const,
        message:
          error instanceof Error ? error.message : "Unknown fetch failure.",
        canonicalUrl: null,
        bodyId: null,
        pageTitle: null,
        hasDataProduct: false,
      },
    };
  }

  const $ = load(html);
  const pageTitle = cleanText($("title").text());
  const canonicalUrl = asAbsoluteUrl($("link[rel='canonical']").attr("href"), sourceUrl);
  const bodyId = cleanText($("body").attr("id"));
  const dataProductAttr = $("[data-product]").first().attr("data-product");
  const hasDataProduct = Boolean(cleanText(dataProductAttr));

  if (bodyId !== "product") {
    return {
      kind: "skipped" as const,
      record: {
        sourceUrl,
        reason: "invalid_product_body" as const,
        message: `Expected body#product but found ${bodyId ?? "none"}.`,
        canonicalUrl,
        bodyId,
        pageTitle,
        hasDataProduct,
      },
    };
  }

  if (!hasDataProduct || !dataProductAttr) {
    return {
      kind: "skipped" as const,
      record: {
        sourceUrl,
        reason: "missing_data_product" as const,
        message: "Missing data-product payload.",
        canonicalUrl,
        bodyId,
        pageTitle,
        hasDataProduct,
      },
    };
  }

  let dataProduct: Record<string, unknown>;
  try {
    dataProduct = JSON.parse(decodeHtmlEntities(dataProductAttr)) as Record<
      string,
      unknown
    >;
  } catch (error) {
    return {
      kind: "skipped" as const,
      record: {
        sourceUrl,
        reason: "invalid_data_product" as const,
        message:
          error instanceof Error
            ? `Unable to parse data-product JSON: ${error.message}`
            : "Unable to parse data-product JSON.",
        canonicalUrl,
        bodyId,
        pageTitle,
        hasDataProduct,
      },
    };
  }

  const shortHtml = normalizeHtmlFragment(
    typeof dataProduct.description_short === "string"
      ? dataProduct.description_short
      : null,
  );
  const fullHtml = normalizeHtmlFragment(
    typeof dataProduct.description === "string"
      ? dataProduct.description
      : null,
  );
  const priceAmount = parseOptionalNumber(dataProduct.price_amount);
  const priceWithoutReductionAmount = parseOptionalNumber(
    dataProduct.price_without_reduction,
  );
  const reductionAmount = parseOptionalNumber(dataProduct.reduction);
  const hasDiscount =
    parseBooleanLike(dataProduct.has_discount) ??
    Boolean(
      (priceWithoutReductionAmount != null &&
        priceAmount != null &&
        priceWithoutReductionAmount > priceAmount) ||
        (reductionAmount != null && reductionAmount > 0),
    );

  const galleryImageUrls = uniqueStrings(
    (Array.isArray(dataProduct.images) ? dataProduct.images : []).map((image) =>
      resolveBestImageUrl(image, sourceUrl),
    ),
  );
  const coverImageUrl = resolveBestImageUrl(dataProduct.cover, sourceUrl);
  const optionSelectors = parseOptionSelectors(html);

  const product: ManifestProductRecord = {
    sourceUrl,
    canonicalUrl,
    sourceFingerprint: "",
    pageTitle,
    meta: {
      title: cleanText(
        typeof dataProduct.meta_title === "string" ? dataProduct.meta_title : null,
      ),
      description: cleanText(
        typeof dataProduct.meta_description === "string"
          ? dataProduct.meta_description
          : null,
      ),
      brand: cleanText($("meta[property='product:brand']").attr("content")),
    },
    product: {
      idProduct: parseOptionalInteger(
        dataProduct.id_product ?? dataProduct.id ?? null,
      ),
      name: cleanText(typeof dataProduct.name === "string" ? dataProduct.name : null),
      linkRewrite: cleanText(
        typeof dataProduct.link_rewrite === "string"
          ? dataProduct.link_rewrite
          : null,
      ),
      category: {
        slug: cleanText(
          typeof dataProduct.category === "string" ? dataProduct.category : null,
        ),
        name: cleanText(
          typeof dataProduct.category_name === "string"
            ? dataProduct.category_name
            : null,
        ),
      },
      quantity: parseOptionalInteger(dataProduct.quantity),
      availability: cleanText(
        typeof dataProduct.availability === "string"
          ? dataProduct.availability
          : null,
      ),
      prices: {
        priceDisplay: cleanText(
          typeof dataProduct.price === "string" ? dataProduct.price : null,
        ),
        priceAmount,
        priceTaxExcAmount: parseOptionalNumber(dataProduct.price_tax_exc),
        priceWithoutReductionAmount,
        reductionAmount,
        hasDiscount,
        specificPrices: dataProduct.specific_prices ?? null,
      },
      descriptions: {
        shortHtml,
        shortText: htmlToText(shortHtml),
        fullHtml,
        fullText: htmlToText(fullHtml),
      },
      imageUrls: {
        cover: coverImageUrl,
        gallery: galleryImageUrls,
        description: extractDescriptionImageUrls(shortHtml, fullHtml, sourceUrl),
      },
      optionSelectors,
      selectedAttributes: parseSelectedAttributes(dataProduct.attributes),
    },
  };

  product.sourceFingerprint = buildSourceFingerprint(product);

  return {
    kind: "product" as const,
    record: product,
  };
}

async function main() {
  console.log(`Fetching sitemap: ${SOURCE_SITEMAP_URL}`);
  const sitemapXml = await fetchText(SOURCE_SITEMAP_URL);
  const sourceUrls = parseSitemapLocs(sitemapXml);

  if (sourceUrls.length === 0) {
    throw new Error("No product URLs found in the sitemap.");
  }

  console.log(
    `Inspecting ${sourceUrls.length} source URLs with concurrency ${CRAWL_CONCURRENCY}...`,
  );

  const inspected = await mapWithConcurrency(
    sourceUrls,
    CRAWL_CONCURRENCY,
    inspectProductPage,
  );

  const products = inspected
    .filter((entry) => entry.kind === "product")
    .map((entry) => entry.record);
  const skipped = inspected
    .filter((entry) => entry.kind === "skipped")
    .map((entry) => entry.record);

  const manifest: SourceManifest = {
    generatedAt: new Date().toISOString(),
    source: {
      siteUrl: SOURCE_SITE_URL,
      sitemapUrl: SOURCE_SITEMAP_URL,
      crawlConcurrency: CRAWL_CONCURRENCY,
    },
    summary: {
      sitemapUrlCount: sourceUrls.length,
      validProductCount: products.length,
      skippedCount: skipped.length,
    },
    products,
    skipped,
  };

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(`${OUTPUT_FILE}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Manifest written to ${OUTPUT_FILE}`);
  console.log(
    JSON.stringify(
      {
        sitemapUrlCount: manifest.summary.sitemapUrlCount,
        validProductCount: manifest.summary.validProductCount,
        skippedCount: manifest.summary.skippedCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("[build-techno-smart-source-manifest] Failed", error);
  process.exitCode = 1;
});
