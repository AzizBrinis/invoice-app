import { load } from "cheerio";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import { slugify } from "@/lib/slug";

export const WEBSITE_CMS_PAGE_MAX_PATH_LENGTH = 180;
export const WEBSITE_CMS_PAGE_MAX_CONTENT_LENGTH = 50000;

const CMS_RESERVED_PREFIXES = [
  "/account",
  "/blog",
  "/cart",
  "/categories",
  "/category",
  "/categorie",
  "/checkout",
  "/collections",
  "/collection",
  "/confirmation",
  "/contact",
  "/contact-us",
  "/contactez-nous",
  "/forgot-password",
  "/login",
  "/order",
  "/order-success",
  "/payment",
  "/panier",
  "/paiement",
  "/product",
  "/products",
  "/produit",
  "/produits",
  "/recherche",
  "/register",
  "/search",
  "/shop",
  "/sign-in",
  "/sign-up",
  "/signin",
  "/signup",
  "/connexion",
  "/inscription",
  "/reset-password",
  "/password-reset",
  "/merci",
  "/payment-success",
  "/order-successful",
  "/payment-successful",
  "/about",
  "/about-us",
  "/a-propos",
];

const CMS_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "h4",
    "a",
    "span",
    "div",
    "code",
    "pre",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    "*": [],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
    h1: "h2",
    h5: "h4",
    h6: "h4",
  },
};

export type WebsiteCmsPageHeading = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
};

export type RenderedWebsiteCmsPageContent = {
  html: string;
  excerpt: string | null;
  headings: WebsiteCmsPageHeading[];
};

function normalizeCmsComparisonPath(path: string) {
  if (!path || path === "/") {
    return "/";
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return "/";
  }
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

export function normalizeWebsiteCmsPagePath(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const sanitized = value
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "");

  const segments = sanitized
    .split("/")
    .map((segment) => slugify(segment))
    .filter(Boolean);

  if (!segments.length) {
    return null;
  }

  const path = normalizeCmsComparisonPath(`/${segments.join("/")}`);
  if (
    !path ||
    path === "/" ||
    path.length > WEBSITE_CMS_PAGE_MAX_PATH_LENGTH
  ) {
    return null;
  }

  return path;
}

export function isReservedWebsiteCmsPagePath(path: string) {
  const normalized = normalizeCmsComparisonPath(path);
  return CMS_RESERVED_PREFIXES.some((prefix) => {
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function renderParagraph(lines: string[]) {
  const text = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  if (!text) {
    return null;
  }
  return `<p>${escapeHtml(text)}</p>`;
}

function renderList(lines: string[], ordered: boolean) {
  const tag = ordered ? "ol" : "ul";
  const items = lines
    .map((line) =>
      line
        .trim()
        .replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, "")
        .trim(),
    )
    .filter(Boolean);

  if (!items.length) {
    return null;
  }

  return `<${tag}>${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</${tag}>`;
}

function renderMarkdownLiteToHtml(source: string) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: string[] = [];
  let paragraphLines: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    const paragraph = renderParagraph(paragraphLines);
    if (paragraph) {
      blocks.push(paragraph);
    }
    paragraphLines = [];
  };

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      const level = Math.min(4, Math.max(2, headingMatch[1].length + 1));
      const text = headingMatch[2].trim();
      if (text) {
        blocks.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
      }
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index]?.trim() ?? "";
        if (!/^>\s?/.test(currentLine)) {
          break;
        }
        quoteLines.push(currentLine.replace(/^>\s?/, "").trim());
        index += 1;
      }
      const quote = quoteLines.filter(Boolean).join(" ");
      if (quote) {
        blocks.push(`<blockquote><p>${escapeHtml(quote)}</p></blockquote>`);
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      const listLines: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index]?.trim() ?? "";
        if (!/^[-*]\s+/.test(currentLine)) {
          break;
        }
        listLines.push(currentLine);
        index += 1;
      }
      const listHtml = renderList(listLines, false);
      if (listHtml) {
        blocks.push(listHtml);
      }
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const listLines: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index]?.trim() ?? "";
        if (!/^\d+\.\s+/.test(currentLine)) {
          break;
        }
        listLines.push(currentLine);
        index += 1;
      }
      const listHtml = renderList(listLines, true);
      if (listHtml) {
        blocks.push(listHtml);
      }
      continue;
    }

    paragraphLines.push(rawLine);
    index += 1;
  }

  flushParagraph();

  return blocks.join("\n");
}

function finalizeRenderedCmsHtml(html: string): RenderedWebsiteCmsPageContent {
  const $ = load(`<div data-cms-root>${html}</div>`);
  const root = $("[data-cms-root]");
  const headings: WebsiteCmsPageHeading[] = [];
  const headingIds = new Map<string, number>();

  root.find("h2, h3, h4").each((_index, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (!text) {
      return;
    }
    const baseId = slugify(text) || `section-${headings.length + 1}`;
    const duplicateCount = headingIds.get(baseId) ?? 0;
    headingIds.set(baseId, duplicateCount + 1);
    const id =
      duplicateCount > 0 ? `${baseId}-${duplicateCount + 1}` : baseId;
    $(element).attr("id", id);
    const tag = element.tagName.toLowerCase();
    headings.push({
      id,
      text,
      level: tag === "h2" ? 2 : tag === "h3" ? 3 : 4,
    });
  });

  const excerptSource =
    root
      .find("p, li")
      .map((_index, element) => $(element).text())
      .get()
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || root.text().replace(/\s+/g, " ").trim();

  return {
    html: root.html() ?? "",
    excerpt: excerptSource ? truncateText(excerptSource, 190) : null,
    headings,
  };
}

export function renderWebsiteCmsPageContent(
  source: string,
): RenderedWebsiteCmsPageContent {
  const trimmed = source.trim();
  if (!trimmed) {
    return {
      html: "",
      excerpt: null,
      headings: [],
    };
  }

  const htmlLike = /<([a-z][a-z0-9-]*)\b[^>]*>/i.test(trimmed);
  const rawHtml = htmlLike ? trimmed : renderMarkdownLiteToHtml(trimmed);
  const sanitized = sanitizeHtml(rawHtml, CMS_SANITIZE_OPTIONS);
  return finalizeRenderedCmsHtml(sanitized);
}

export function summarizeWebsiteCmsPageContent(source: string) {
  return renderWebsiteCmsPageContent(source).excerpt;
}
