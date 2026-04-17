import { load } from "cheerio";
import sanitizeHtml, { type IOptions } from "sanitize-html";
import { slugify } from "@/lib/slug";

export const WEBSITE_BLOG_MAX_BODY_LENGTH = 80000;
export const WEBSITE_BLOG_MAX_EXCERPT_LENGTH = 360;
const BLOG_READING_WORDS_PER_MINUTE = 220;

const BLOG_SANITIZE_OPTIONS: IOptions = {
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
    "h5",
    "h6",
    "a",
    "span",
    "div",
    "img",
    "code",
    "pre",
    "hr",
    "figure",
    "figcaption",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    "*": [],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
    h1: "h2",
  },
};

export type WebsiteBlogHeading = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
};

export type RenderedWebsiteBlogContent = {
  html: string;
  excerpt: string | null;
  headings: WebsiteBlogHeading[];
  wordCount: number;
  readingTimeMinutes: number;
};

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function countWords(value: string) {
  if (!value) {
    return 0;
  }
  return value.split(/\s+/).filter(Boolean).length;
}

export function sanitizeWebsiteBlogHtml(source: string) {
  if (!source) {
    return "";
  }
  return sanitizeHtml(source, BLOG_SANITIZE_OPTIONS);
}

export function stripWebsiteBlogHtml(source: string) {
  if (!source) {
    return "";
  }

  return sanitizeHtml(source, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

export function renderWebsiteBlogContent(
  source: string,
  excerptOverride?: string | null,
): RenderedWebsiteBlogContent {
  const html = sanitizeWebsiteBlogHtml(source);
  if (!html) {
    return {
      html: "",
      excerpt: normalizeText(excerptOverride) || null,
      headings: [],
      wordCount: 0,
      readingTimeMinutes: 1,
    };
  }

  const $ = load(`<article data-blog-root>${html}</article>`);
  const root = $("[data-blog-root]");
  const headings: WebsiteBlogHeading[] = [];
  const seenIds = new Set<string>();

  root.find("h2, h3, h4").each((_, element) => {
    const node = $(element);
    const text = normalizeText(node.text());
    if (!text) {
      return;
    }

    let idBase = slugify(text) || `heading-${headings.length + 1}`;
    let id = idBase;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);
    node.attr("id", id);

    const tagName = node.prop("tagName")?.toLowerCase();
    const level = tagName === "h2" ? 2 : tagName === "h3" ? 3 : 4;
    headings.push({
      id,
      text,
      level,
    });
  });

  const text = normalizeText(root.text());
  const wordCount = countWords(text);
  const readingTimeMinutes = Math.max(
    1,
    Math.ceil(wordCount / BLOG_READING_WORDS_PER_MINUTE),
  );
  const excerptSource = normalizeText(excerptOverride) || text;

  return {
    html: root.html() ?? html,
    excerpt: excerptSource
      ? truncateText(excerptSource, WEBSITE_BLOG_MAX_EXCERPT_LENGTH)
      : null,
    headings,
    wordCount,
    readingTimeMinutes,
  };
}

export { BLOG_SANITIZE_OPTIONS };
