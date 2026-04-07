import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildProductFormValidationState } from "@/server/product-form-errors";

describe("buildProductFormValidationState", () => {
  it("only returns the field that actually failed validation", () => {
    const result = z
      .object({
        coverImageUrl: z.string().url("URL invalide"),
      })
      .safeParse({
        coverImageUrl: "not-a-url",
      });

    expect(result.success).toBe(false);
    if (result.success) return;

    const validationState = buildProductFormValidationState(result.error);

    expect(validationState.message).toBe("URL invalide");
    expect(validationState.fieldErrors.coverImageUrl).toBe("URL invalide");
    expect(validationState.fieldErrors.sku).toBeUndefined();
    expect(validationState.fieldErrors.name).toBeUndefined();
    expect(validationState.fieldErrors.publicSlug).toBeUndefined();
  });

  it("maps fixed-discount errors to the shared discount field", () => {
    const result = z
      .object({
        defaultDiscountAmountCents: z.number().int("Remise invalide"),
      })
      .safeParse({
        defaultDiscountAmountCents: 12.5,
      });

    expect(result.success).toBe(false);
    if (result.success) return;

    const validationState = buildProductFormValidationState(result.error);

    expect(validationState.message).toBe("Remise invalide");
    expect(validationState.fieldErrors.defaultDiscount).toBe("Remise invalide");
    expect(validationState.fieldErrors.vatRate).toBeUndefined();
  });
});
