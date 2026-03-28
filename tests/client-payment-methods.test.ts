import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLIENT_PAYMENT_METHODS,
  normalizeClientPaymentMethods,
} from "@/lib/client-payment-methods";

describe("client payment methods helpers", () => {
  it("falls back to the default method list when no configuration exists", () => {
    expect(normalizeClientPaymentMethods(undefined)).toEqual(
      DEFAULT_CLIENT_PAYMENT_METHODS,
    );
  });

  it("trims, deduplicates, and keeps the configured order", () => {
    expect(
      normalizeClientPaymentMethods([
        "  Virement bancaire  ",
        "",
        "Cheque",
        "virement bancaire",
        " Carte bancaire ",
      ]),
    ).toEqual(["Virement bancaire", "Cheque", "Carte bancaire"]);
  });

  it("can preserve an explicit empty result during form validation", () => {
    expect(
      normalizeClientPaymentMethods(["", "   "], {
        fallbackToDefaults: false,
      }),
    ).toEqual([]);
  });
});
