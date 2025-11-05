const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function extractPlaceholders(template: string): string[] {
  if (!template) return [];
  const matches = new Set<string>();
  let result: RegExpExecArray | null;
  while ((result = PLACEHOLDER_REGEX.exec(template)) !== null) {
    const name = result[1]?.trim();
    if (name) {
      matches.add(name);
    }
  }
  return Array.from(matches);
}

export function fillPlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  if (!template) return template;
  return template.replace(PLACEHOLDER_REGEX, (_match, name: string) => {
    const key = name.trim();
    if (!key.length) return _match;
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key] ?? "";
    }
    return _match;
  });
}

export type PlaceholderValueMap = Record<string, string>;
