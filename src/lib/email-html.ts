import sanitizeHtml, { type IOptions } from "sanitize-html";

const BASE_ALLOWED_ATTRIBUTES = sanitizeHtml.defaults.allowedAttributes;

function extendAttributes(tag: string, extras: string[]): string[] {
  const existing = BASE_ALLOWED_ATTRIBUTES[tag] ?? [];
  const merged = [...existing];
  for (const attribute of extras) {
    if (!merged.includes(attribute)) {
      merged.push(attribute);
    }
  }
  return merged;
}

const EMAIL_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": extendAttributes("*", ["style"]),
    a: extendAttributes("a", ["rel"]),
    img: extendAttributes("img", ["width", "height", "style"]),
    table: extendAttributes("table", ["cellpadding", "cellspacing", "width", "align", "role", "border"]),
    tr: extendAttributes("tr", ["align", "valign"]),
    td: extendAttributes("td", ["colspan", "rowspan", "align", "valign", "width"]),
    th: extendAttributes("th", ["colspan", "rowspan", "align", "valign", "width"]),
  },
  allowedStyles: {
    "*": {
      "background-color": [/^.*$/],
      border: [/^.*$/],
      "border-bottom": [/^.*$/],
      "border-collapse": [/^.*$/],
      "border-left": [/^.*$/],
      "border-radius": [/^.*$/],
      "border-right": [/^.*$/],
      "border-top": [/^.*$/],
      "border-spacing": [/^.*$/],
      color: [/^.*$/],
      display: [/^.*$/],
      "font-family": [/^.*$/],
      "font-size": [/^.*$/],
      "font-weight": [/^.*$/],
      "letter-spacing": [/^.*$/],
      "line-height": [/^.*$/],
      margin: [/^.*$/],
      "margin-bottom": [/^.*$/],
      "margin-left": [/^.*$/],
      "margin-right": [/^.*$/],
      "margin-top": [/^.*$/],
      padding: [/^.*$/],
      "padding-bottom": [/^.*$/],
      "padding-left": [/^.*$/],
      "padding-right": [/^.*$/],
      "padding-top": [/^.*$/],
      "text-align": [/^.*$/],
      "text-transform": [/^.*$/],
      width: [/^.*$/],
      "max-width": [/^.*$/],
      "min-width": [/^.*$/],
      height: [/^.*$/],
      "vertical-align": [/^.*$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
  },
};

export function sanitizeEmailHtml(source: string): string {
  if (!source) {
    return "";
  }
  return sanitizeHtml(source, EMAIL_SANITIZE_OPTIONS);
}

export { EMAIL_SANITIZE_OPTIONS };
