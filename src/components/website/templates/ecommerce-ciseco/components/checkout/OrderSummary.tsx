"use client";

import clsx from "clsx";
import { useMemo } from "react";
import type {
  CartLine,
  CartProductOption,
} from "@/components/website/cart/cart-context";
import { useCart } from "@/components/website/cart/cart-context";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { ThemeTokens } from "../../types";

type OrderSummaryProps = {
  theme: ThemeTokens;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  showPrices: boolean;
};

type DiscountRowProps = {
  theme: ThemeTokens;
};

const inputClassName =
  "w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const CURRENCY_CODE = "TND";
const COLOR_KEYS = ["color", "colour", "couleur"];
const SIZE_KEYS = ["size", "taille"];

const resolveOptionValue = (
  options: CartProductOption[] | null | undefined,
  keys: string[],
) => {
  if (!options?.length) return null;
  const match = options.find((option) =>
    keys.some((key) => option.name.toLowerCase().includes(key)),
  );
  return match?.value ?? null;
};

export function OrderSummary({
  theme,
  isSubmitting,
  isSubmitDisabled,
  showPrices,
}: OrderSummaryProps) {
  const {
    items,
    totals,
    totalAmountCents,
    hasMissingPrices,
    isHydrated,
    updateItemQuantity,
    removeItem,
  } = useCart();
  const { subtotalCents, taxCents } = useMemo(() => {
    if (!totals) {
      return { subtotalCents: null, taxCents: null };
    }
    return {
      subtotalCents: totals.subtotalHTCents,
      taxCents: totals.totalTVACents,
    };
  }, [totals]);
  const totalCents = totalAmountCents ?? null;
  const formatCents = (amountCents: number | null) =>
    showPrices && amountCents != null
      ? formatCurrency(fromCents(amountCents, CURRENCY_CODE), CURRENCY_CODE)
      : "--";
  const subtotalLabel = formatCents(subtotalCents);
  const shippingLabel = showPrices ? formatCurrency(0, CURRENCY_CODE) : "--";
  const taxLabel = formatCents(taxCents);
  const totalLabel = formatCents(totalCents);
  const warningMessage = !showPrices
    ? "Pricing is hidden for this shop. Please contact us."
    : hasMissingPrices
      ? "Some items could not be priced. Remove them to continue."
      : null;

  return (
    <aside className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
      <div className="divide-y divide-black/5">
        {!isHydrated ? (
          <div className="py-5 text-sm text-slate-500">Loading cart...</div>
        ) : items.length === 0 ? (
          <div className="py-5 text-sm text-slate-500">
            Your cart is empty.
          </div>
        ) : (
          items.map((item) => (
            <OrderSummaryItem
              key={item.id}
              item={item}
              showPrices={showPrices}
              isSubmitting={isSubmitting}
              onDecrease={() =>
                updateItemQuantity(item.id, Math.max(1, item.quantity - 1))
              }
              onIncrease={() =>
                updateItemQuantity(item.id, item.quantity + 1)
              }
              onRemove={() => removeItem(item.id)}
            />
          ))
        )}
      </div>
      <div className="space-y-6 border-t border-black/5 pt-6">
        <DiscountRow theme={theme} />
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-900">
              {subtotalLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipping estimate</span>
            <span className="font-semibold text-slate-900">
              {shippingLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tax estimate</span>
            <span className="font-semibold text-slate-900">{taxLabel}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-sm font-semibold text-slate-900">
            <span>Order total</span>
            <span>{totalLabel}</span>
          </div>
        </div>
      </div>
      {warningMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {warningMessage}
        </div>
      ) : null}
      <button
        type="submit"
        className={clsx(
          theme.buttonShape,
          "w-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60",
        )}
        disabled={isSubmitDisabled}
      >
        {isSubmitting ? "Submitting..." : "Confirm order"}
      </button>
      <p className="flex flex-wrap items-center justify-center gap-1 text-center text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <InfoIcon />
          Learn more
        </span>
        <a
          href="#"
          className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2"
        >
          Taxes
        </a>
        <span>and</span>
        <a
          href="#"
          className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2"
        >
          Shipping
        </a>
        <span>information</span>
      </p>
    </aside>
  );
}

export function DiscountRow({ theme }: DiscountRowProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-700">Discount code</p>
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder=""
          className={clsx(inputClassName, "flex-1")}
        />
        <button
          type="button"
          className={clsx(
            theme.buttonShape,
            "shrink-0 border border-black/10 bg-white px-5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-slate-900",
          )}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

type OrderSummaryItemProps = {
  item: CartLine;
  showPrices: boolean;
  isSubmitting: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
};

function OrderSummaryItem({
  item,
  showPrices,
  isSubmitting,
  onDecrease,
  onIncrease,
  onRemove,
}: OrderSummaryItemProps) {
  const selectedOptions = item.product.selectedOptions ?? [];
  const resolvedColor = resolveOptionValue(selectedOptions, COLOR_KEYS);
  const resolvedSize = resolveOptionValue(selectedOptions, SIZE_KEYS);
  const extraOptions = selectedOptions.filter((option) => {
    const name = option.name.toLowerCase();
    return !COLOR_KEYS.some((key) => name.includes(key)) &&
      !SIZE_KEYS.some((key) => name.includes(key));
  });
  const extraOptionsLabel = extraOptions.length
    ? extraOptions.map((option) => `${option.name}: ${option.value}`).join(" · ")
    : null;
  const colorLabel = resolvedColor ?? "Standard";
  const sizeLabel = resolvedSize ?? "One size";
  const unitPriceLabel = showPrices
    ? item.product.unitAmountCents != null
      ? formatCurrency(
          fromCents(item.product.unitAmountCents, CURRENCY_CODE),
          CURRENCY_CODE,
        )
      : item.product.price || "--"
    : "--";
  const imageSrc =
    item.product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const title = item.product.title || "Item";

  return (
    <div className="flex gap-4 py-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-3 shadow-sm">
        <img
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ColorIcon />
                {colorLabel}
              </span>
              <span className="h-3 w-px bg-black/10" />
              <span className="flex items-center gap-1">
                <SizeIcon />
                {sizeLabel}
              </span>
            </div>
            {extraOptionsLabel ? (
              <p className="text-xs text-slate-500">{extraOptionsLabel}</p>
            ) : null}
          </div>
          <span className="rounded-full border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-600">
            {unitPriceLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-60"
              aria-label={`Decrease quantity for ${title}`}
              onClick={onDecrease}
              disabled={isSubmitting || item.quantity <= 1}
            >
              -
            </button>
            <span className="min-w-[1.5rem] text-center text-xs font-semibold text-slate-700">
              {item.quantity}
            </span>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-60"
              aria-label={`Increase quantity for ${title}`}
              onClick={onIncrease}
              disabled={isSubmitting}
            >
              +
            </button>
          </div>
          <a
            href="#"
            className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
            onClick={(event) => {
              event.preventDefault();
              if (isSubmitting) return;
              onRemove();
            }}
            aria-disabled={isSubmitting}
          >
            Remove
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M12 10v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7" r="1" fill="currentColor" />
    </svg>
  );
}

function ColorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M12 4l5 6a6 6 0 1 1-10 0l5-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function SizeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M5 9h14M7 6v12M17 6v12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
