/** @vitest-environment jsdom */
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { DEFAULT_TAX_CONFIGURATION } from "@/lib/taxes";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ addToast: vi.fn() }) }));
vi.mock("@/app/(app)/factures/actions", () => ({ submitInvoiceFormAction: vi.fn() }));

const defaults = {
  submitLabel: "Enregistrer", defaultCurrency: "TND" as const,
  clients: [{ id: "client", displayName: "Client" }],
  currencyOptions: SUPPORTED_CURRENCIES, taxConfiguration: DEFAULT_TAX_CONFIGURATION,
};
const saved = {
  id: "document", number: "DOC-1", clientId: "client", status: "BROUILLON",
  currency: "TND", issueDate: new Date(),
  taxConfiguration: { ...DEFAULT_TAX_CONFIGURATION, linePricing: [{ position: 4, unitPriceTTCCents: 3 }] },
  lines: [{ id: "line", description: "Produit", position: 4, quantity: 1, unit: "unité",
    unitPriceHTCents: 3, vatRate: 19, discountRate: null, discountAmountCents: 0 }],
};

describe("complete quote and invoice editors", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => { container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
  afterEach(async () => { await act(() => root.unmount()); container.remove(); });
  async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
    await act(() => {
      const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
      element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    });
  }
  const priceInputs = () => [...container.querySelectorAll<HTMLInputElement>('input[aria-label^="Prix unitaire"]')];
  async function serializedPayload() {
    const form = container.querySelector("form")!;
    form.addEventListener("submit", (event) => event.preventDefault(), { once: true });
    await act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    return JSON.parse(container.querySelector<HTMLInputElement>('input[name="payload"]')!.value);
  }
  for (const kind of ["quote", "invoice"] as const) {
    it(`creates a ${kind} with TTC and keeps desktop/mobile controls synchronized`, async () => {
      await act(() => root.render(kind === "quote" ? createElement(QuoteEditor, { ...defaults, action: vi.fn() })
        : createElement(InvoiceEditor, { ...defaults, products: [], clients: defaults.clients as ComponentProps<typeof InvoiceEditor>["clients"] })));
      const modes = container.querySelectorAll<HTMLSelectElement>('[aria-label="Mode de saisie du prix"]');
      await change(modes[0], "TTC");
      await change(priceInputs()[0], "119.000");
      expect(priceInputs()).toHaveLength(2);
      expect(priceInputs().every((input) => input.value === "119.000")).toBe(true);
      expect((await serializedPayload()).lines[0]).toMatchObject({ unitPriceHTCents: 100000, unitPriceTTCCents: 119000, vatRate: 19 });
      const rates = container.querySelectorAll<HTMLSelectElement>('[aria-label="Taux de TVA"]');
      await change(rates[1], "13");
      expect((await serializedPayload()).lines[0]).toMatchObject({ unitPriceHTCents: 105310, unitPriceTTCCents: 119000, vatRate: 13 });
    });

    it(`accepts comma prices and discounts in both ${kind} layouts and preserves payload precision`, async () => {
      const props = { ...defaults, defaultCurrency: "EUR" as const };
      await act(() => root.render(kind === "quote" ? createElement(QuoteEditor, { ...props, action: vi.fn() })
        : createElement(InvoiceEditor, { ...props, products: [], clients: defaults.clients as ComponentProps<typeof InvoiceEditor>["clients"] })));
      await change(priceInputs()[0], "12,345");
      expect(priceInputs().every((input) => input.value === "12,345")).toBe(true);
      expect(priceInputs()[0].checkValidity()).toBe(true);
      const discounts = [...container.querySelectorAll<HTMLInputElement>('input[max="100"]')].filter(input => input.id !== "globalDiscountRate");
      expect(discounts).toHaveLength(2);
      await change(discounts[0], "12,");
      expect(discounts[0].value).toBe("12,");
      await change(discounts[1], "12,345");
      expect(discounts.every(input => input.value === "12,345")).toBe(true);
      await change(container.querySelector<HTMLInputElement>('#globalDiscountRate')!, "1,234");
      let payload = await serializedPayload();
      expect(payload.lines[0]).toMatchObject({ unitPriceHTCents: 1234.5, discountRate: 12.345 });
      expect(payload.globalDiscountRate).toBe(1.234);
      expect(payload.globalDiscountAmountCents).toBeNull();
      await change(container.querySelector<HTMLInputElement>('#globalDiscountAmount')!, "1,234");
      payload = await serializedPayload();
      expect(payload.globalDiscountRate).toBeNull();
      expect(payload.globalDiscountAmountCents).toBe(123.4);
      for (const input of [priceInputs()[0], discounts[0], container.querySelector<HTMLInputElement>('#globalDiscountRate')!]) {
        await change(input, "12,3456");
        expect(input.checkValidity()).toBe(false);
      }
    });

    it(`reopens a ${kind} from its TTC snapshot and resubmits without drift`, async () => {
      await act(() => root.render(kind === "quote" ? createElement(QuoteEditor, {
        ...defaults, action: vi.fn(), defaultQuote: saved as unknown as ComponentProps<typeof QuoteEditor>["defaultQuote"],
      }) : createElement(InvoiceEditor, {
        ...defaults, products: [], clients: defaults.clients as ComponentProps<typeof InvoiceEditor>["clients"],
        defaultInvoice: saved as unknown as ComponentProps<typeof InvoiceEditor>["defaultInvoice"],
      })));
      expect(priceInputs().every((input) => input.value === "0.003")).toBe(true);
      expect((await serializedPayload()).lines[0]).toMatchObject({ unitPriceHTCents: 3, unitPriceTTCCents: 3, position: 0 });
    });
  }
});
