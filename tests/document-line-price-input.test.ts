/** @vitest-environment jsdom */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocumentLinePriceInput, DocumentVatSelect } from "@/components/document-line-price-input";
import { documentLinePricePayload, type DocumentLinePriceForm } from "@/lib/document-line-pricing";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Editor({ initial }: { initial: DocumentLinePriceForm }) {
  const [line, setLine] = useState(initial);
  return createElement("form", null,
    createElement(DocumentLinePriceInput, { line, currency: "TND", onChange: (updates) => setLine((previous) => ({ ...previous, ...updates })) }),
    createElement(DocumentVatSelect, { value: line.vatRate, config: DEFAULT_TAX_CONFIGURATION, onChange: (vatRate) => setLine((previous) => ({ ...previous, vatRate })) }),
    createElement("output", null, JSON.stringify(documentLinePricePayload(line, "TND"))),
  );
}

describe("shared quote/invoice price inputs", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(() => root.unmount()); container.remove(); });
  async function render(initial: DocumentLinePriceForm) { await act(() => root.render(createElement(Editor, { initial }))); }
  async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
    await act(() => {
      const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  }
  const price = () => container.querySelector("input")!;
  const mode = () => container.querySelectorAll("select")[0];
  const rate = () => container.querySelectorAll("select")[1];
  const payload = () => JSON.parse(container.querySelector("output")!.textContent!);

  it("allows TTC entry, shows three decimals, and holds TTC fixed on VAT changes", async () => {
    await render({ unitPrice: 0, vatRate: 19 });
    await change(mode(), "TTC");
    await change(price(), "119.000");
    expect(price().step).toBe("0.001");
    expect(container.textContent).toContain("HT 100.000 · TVA 19.000 · TTC 119.000");
    await change(rate(), "7");
    expect(price().value).toBe("119.000");
    expect(payload()).toEqual({ unitPriceHTCents: 111215, unitPriceTTCCents: 119000 });
    await change(rate(), "0");
    expect(container.textContent).toContain("HT 119.000 · TVA 0.000 · TTC 119.000");
  });

  it("loads stored TTC, including a non-round-trippable millime, and retains HT mode", async () => {
    await render({ unitPrice: 0.003, unitPriceTTC: 0.003, vatRate: 19 });
    expect(price().value).toBe("0.003");
    expect(payload().unitPriceTTCCents).toBe(3);
    await change(mode(), "HT");
    await change(price(), "100.001");
    await change(rate(), "13");
    expect(payload()).toEqual({ unitPriceHTCents: 100001 });
    expect(container.textContent).toContain("HT 100.001 · TVA 13.000 · TTC 113.001");
  });

  it("does not silently accept empty, negative, or over-precision prices", async () => {
    await render({ unitPrice: 100, vatRate: 19 });
    for (const value of ["", "-1", "1.0001"]) {
      await change(price(), value);
      expect(price().getAttribute("aria-invalid")).toBe("true");
      expect(price().checkValidity()).toBe(false);
      expect(payload().unitPriceHTCents).toBeNull();
    }
  });
});
