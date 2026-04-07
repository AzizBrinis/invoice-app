import sanitizeHtml, { type IOptions } from "sanitize-html";

const PRODUCT_SANITIZE_OPTIONS: IOptions = {
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
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": [],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
  },
};

export function sanitizeProductHtml(source: string): string {
  if (!source) {
    return "";
  }
  return sanitizeHtml(source, PRODUCT_SANITIZE_OPTIONS);
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
