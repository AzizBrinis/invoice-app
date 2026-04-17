import sanitizeHtml, { type IOptions } from "sanitize-html";

const PRODUCT_ALLOWED_TAGS = [
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
] as const;

type ProductHtmlSanitizeOptions = {
  imageAltFallback?: string | null;
};

function buildProductSanitizeOptions(
  options?: ProductHtmlSanitizeOptions,
): IOptions {
  return {
    allowedTags: [...PRODUCT_ALLOWED_TAGS],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: [
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "decoding",
        "fetchpriority",
      ],
      "*": [],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "data"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
      }),
      img: (tagName, attribs) => {
        const src = attribs.src?.trim();
        if (!src) {
          return {
            tagName: "span",
            text: "",
          };
        }

        const alt = attribs.alt?.trim() || options?.imageAltFallback?.trim() || "";

        return {
          tagName,
          attribs: {
            src,
            alt,
            ...(attribs.title?.trim()
              ? { title: attribs.title.trim() }
              : {}),
            ...(attribs.width?.trim()
              ? { width: attribs.width.trim() }
              : {}),
            ...(attribs.height?.trim()
              ? { height: attribs.height.trim() }
              : {}),
            loading: "lazy",
            decoding: "async",
            fetchpriority: "low",
          },
        };
      },
    },
  };
}

const PRODUCT_SANITIZE_OPTIONS = buildProductSanitizeOptions();

export function sanitizeProductHtml(
  source: string,
  options?: ProductHtmlSanitizeOptions,
): string {
  if (!source) {
    return "";
  }
  return sanitizeHtml(source, buildProductSanitizeOptions(options));
}

export function stripProductHtml(source: string): string {
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

export { PRODUCT_SANITIZE_OPTIONS };
