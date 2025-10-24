import { describe, it, expect } from "vitest";
import { formatPercent } from "@/lib/formatters";

describe("formatters", () => {
  it("formats percentage values in Tunisian locale", () => {
    expect(formatPercent(19, "TND")).toBe("19,00\u00a0%");
    expect(formatPercent(7.5, "TND")).toBe("7,50\u00a0%");
  });
});
