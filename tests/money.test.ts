import { describe, expect, it } from "vitest";
import { parseMinorUnitInput, toCents } from "@/lib/money";

describe("money helpers", () => {
  it("uses currency precision when converting optimistic form values", () => {
    expect(parseMinorUnitInput("1000", "TND")).toBe(1_000_000);
    expect(parseMinorUnitInput("1000", "EUR")).toBe(100_000);
  });

  it("accepts comma decimals and matches toCents", () => {
    expect(parseMinorUnitInput("12,345", "TND")).toBe(toCents(12.345, "TND"));
    expect(parseMinorUnitInput("12,34", "EUR")).toBe(toCents(12.34, "EUR"));
  });
});
