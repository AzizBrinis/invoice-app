"use client";

import type {
  CartLine,
  CartProductOption,
} from "@/components/website/cart/cart-context";
import { useCart } from "@/components/website/cart/cart-context";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";

type CartItemRowProps = {
  item: CartLine;
};

const QUANTITY_OPTIONS = [1, 2, 3, 4];
const CURRENCY_CODE = "TND";
const STOCK_LABEL = "In Stock";
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

const resolveQuantityOptions = (quantity: number) => {
  if (quantity <= QUANTITY_OPTIONS[QUANTITY_OPTIONS.length - 1]) {
    return QUANTITY_OPTIONS;
  }
  return [...QUANTITY_OPTIONS, quantity].sort((left, right) => left - right);
};

export function CartItemRow({ item }: CartItemRowProps) {
  const { updateItemQuantity, removeItem } = useCart();
  const quantityOptions = resolveQuantityOptions(item.quantity);
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
  const unitPriceLabel =
    item.product.unitAmountCents != null
      ? formatCurrency(
          fromCents(item.product.unitAmountCents, CURRENCY_CODE),
          CURRENCY_CODE,
        )
      : item.product.price || "--";
  const imageSrc =
    item.product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const title = item.product.title || "Item";

  return (
    <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex flex-1 items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-3 shadow-sm sm:h-28 sm:w-28">
          <img
            src={imageSrc}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-slate-900 sm:text-base">
            {title}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path
                  d="M12 4l5 6a6 6 0 1 1-10 0l5-6z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
              {colorLabel}
            </span>
            <span className="h-3 w-px bg-black/10" />
            <span className="flex items-center gap-1">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path
                  d="M5 9h14M7 6v12M17 6v12"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              {sizeLabel}
            </span>
          </div>
          {extraOptionsLabel ? (
            <p className="text-xs text-slate-500">{extraOptionsLabel}</p>
          ) : null}
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
              />
              <path
                d="M8 12.5l2.5 2.5L16 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {STOCK_LABEL}
          </span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
              aria-label={`Decrease quantity for ${title}`}
              onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
            >
              -
            </button>
            <span className="min-w-[1.5rem] text-center text-sm font-semibold text-slate-700">
              {item.quantity}
            </span>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
              aria-label={`Increase quantity for ${title}`}
              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
            >
              +
            </button>
          </div>
          <div className="flex w-full items-center justify-between sm:hidden">
            <label className="sr-only" htmlFor={`quantity-${item.id}`}>
              Quantity for {title}
            </label>
            <select
              id={`quantity-${item.id}`}
              value={item.quantity}
              onChange={(event) => {
                const nextQuantity = Number(event.target.value);
                if (!Number.isFinite(nextQuantity)) return;
                updateItemQuantity(item.id, nextQuantity);
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {quantityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="rounded-full border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-600">
              {unitPriceLabel}
            </span>
          </div>
        </div>
        <div className="hidden flex-col items-end gap-3 sm:flex">
          <span className="rounded-full border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-600">
            {unitPriceLabel}
          </span>
          <a
            href="#"
            className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
            onClick={(event) => {
              event.preventDefault();
              removeItem(item.id);
            }}
          >
            Remove
          </a>
        </div>
        <div className="flex justify-end sm:hidden">
          <a
            href="#"
            className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
            onClick={(event) => {
              event.preventDefault();
              removeItem(item.id);
            }}
          >
            Remove
          </a>
        </div>
      </div>
    </div>
  );
}
