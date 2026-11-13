/** @vitest-environment jsdom */
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProductPriceFields } from "@/app/(app)/produits/product-price-fields";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";
import { parseProductPriceFields } from "@/lib/product-price-input";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("shared create/edit product price fields", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
  });
  async function render(props: Partial<ComponentProps<typeof ProductPriceFields>> = {}) {
    await act(() => root.render(createElement("form", null, createElement(ProductPriceFields, {
      currencyCode: "TND", taxConfiguration: DEFAULT_TAX_CONFIGURATION, ...props,
    }))));
  }
  const input = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!;
  async function change(id: string, value: string) {
    const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    await act(() => {
      const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  }

  it("creates from TTC and holds TTC fixed as VAT changes", async () => {
    await render();
    expect(input("priceTTC").step).toBe("0.001");
    await change("priceTTC", "119.000");
    expect(input("priceHT").value).toBe("100.000");
    expect(input("vatAmount").value).toBe("19.000");
    await change("vatRate", "7");
    expect(input("priceTTC").value).toBe("119.000");
    expect(input("priceHT").value).toBe("111.215");
    expect(input("vatAmount").value).toBe("7.785");
    await change("vatRate", "0");
    expect(input("priceHT").value).toBe("119.000");
    expect(input("vatAmount").value).toBe("0.000");
  });

  it("retains HT editing and recalculates TTC on rate changes", async () => {
    await render();
    await change("priceBasis", "HT");
    expect(input("priceHT").readOnly).toBe(false);
    expect(input("priceTTC").readOnly).toBe(true);
    await change("priceHT", "100.001");
    expect(input("priceTTC").value).toBe("119.001");
    await change("vatRate", "13");
    expect(input("priceHT").value).toBe("100.001");
    expect(input("priceTTC").value).toBe("113.001");
  });

  it("loads stored TTC without a millime drift and submits the selected basis", async () => {
    await render({ defaultValues: { priceHTCents: 3, priceTTCCents: 3, vatRate: 19 } });
    expect(input("priceTTC").value).toBe("0.003");
    const result = parseProductPriceFields(new FormData(container.querySelector("form")!), "TND", DEFAULT_TAX_CONFIGURATION);
    expect(result).toEqual({ priceHTCents: 3, priceTTCCents: 3, vatRate: 19 });
    await change("priceTTC", "238.000");
    expect(input("priceHT").value).toBe("200.000");
    await change("vatRate", "13");
    expect(input("priceHT").value).toBe("210.619");
  });

  it("keeps existing legacy rates selectable and displays custom labels", async () => {
    await render({ defaultValues: { priceHTCents: 100000, priceTTCCents: 120000, vatRate: 20 } });
    expect(input("vatRate").value).toBe("20");
    expect(container.textContent).toContain("taux existant");
    expect(input("priceHT").value).toBe("100.000");
  });

  it("clears stale calculations for empty or invalid prices and shows field errors", async () => {
    await render();
    await change("priceTTC", "119");
    await change("priceTTC", "");
    expect(input("priceHT").value).toBe("");
    expect(input("priceTTC").checkValidity()).toBe(false);
    await change("priceTTC", "1.2345");
    expect(input("priceHT").value).toBe("");
    expect(input("priceTTC").getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("3 décimales");
  });
});
