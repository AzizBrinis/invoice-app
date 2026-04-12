export type SqlChunk = string | SqlFragment | SqlRaw;

export type SqlFragment = {
  kind: "fragment";
  strings: string[];
  values: unknown[];
};

export type SqlRaw = {
  kind: "raw";
  text: string;
};

export function isSqlFragment(value: unknown): value is SqlFragment {
  return Boolean(value) && typeof value === "object" && (value as SqlFragment).kind === "fragment";
}

export function isSqlRaw(value: unknown): value is SqlRaw {
  return Boolean(value) && typeof value === "object" && (value as SqlRaw).kind === "raw";
}

export function raw(text: string): SqlRaw {
  return { kind: "raw", text };
}

export function fragment(
  strings: TemplateStringsArray | string[],
  ...values: unknown[]
): SqlFragment {
  return {
    kind: "fragment",
    strings: Array.from(strings),
    values,
  };
}

export function join(
  values: unknown[],
  separator: string | SqlFragment | SqlRaw = ", ",
): SqlFragment {
  if (values.length === 0) {
    return fragment([""]);
  }

  const strings = [""];
  const entries: unknown[] = [];

  for (let index = 0; index < values.length; index += 1) {
    if (index > 0) {
      entries.push(typeof separator === "string" ? raw(separator) : separator);
      strings.push("");
    }

    entries.push(values[index]);
    strings.push("");
  }

  return {
    kind: "fragment",
    strings,
    values: entries,
  };
}

export const empty = fragment([""]);
