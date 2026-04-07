"use client";

import type {
  CartLine,
} from "@/components/website/cart/cart-context";
import { useCart } from "@/components/website/cart/cart-context";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import { useCisecoI18n } from "../../i18n";
import { CatalogImage } from "../shared/CatalogImage";

type CartItemRowProps = {
  item: CartLine;
};

const QUANTITY_OPTIONS = [1, 2, 3, 4];
const STOCK_LABEL = "In Stock";
const resolveQuantityOptions = (quantity: number) => {
  if (quantity <= QUANTITY_OPTIONS[QUANTITY_OPTIONS.length - 1]) {
    return QUANTITY_OPTIONS;
  }
  return [...QUANTITY_OPTIONS, quantity].sort((left, right) => left - right);
};

export function CartItemRow({ item }: CartItemRowProps) {
  const { t } = useCisecoI18n();
  const { updateItemQuantity, removeItem } = useCart();
  const quantityOptions = resolveQuantityOptions(item.quantity);
  const selectedOptions = item.product.selectedOptions ?? [];
  const optionsLabel = selectedOptions.length
    ? selectedOptions
        .map((option) => `${t(option.name)}: ${t(option.value)}`)
        .join(" · ")
    : null;
  const currencyCode = item.product.currencyCode || "TND";
  const effectiveUnitAmountCents =
    item.lineTotalCents != null
      ? Math.round(item.lineTotalCents / item.quantity)
      : item.product.unitAmountCents;
  const unitPriceLabel =
    effectiveUnitAmountCents != null
      ? formatCurrency(
          fromCents(effectiveUnitAmountCents, currencyCode),
          currencyCode,
        )
      : item.product.price || "--";
  const imageSrc =
    item.product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const title = t(item.product.title || "Item");

  return (
    <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:gap-6">
      <div className="flex flex-1 items-start gap-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-3 shadow-sm sm:h-28 sm:w-28">
          <CatalogImage
            src={imageSrc}
            alt={title}
            className="h-full w-full object-cover"
            sizes="112px"
            fill
            loading="lazy"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-slate-900 sm:text-base">
            {title}
          </p>
          {optionsLabel ? (
            <p className="text-xs text-slate-500">{optionsLabel}</p>
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
            {t(STOCK_LABEL)}
          </span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
              aria-label={`${t("Decrease quantity")} ${title}`}
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
              aria-label={`${t("Increase quantity")} ${title}`}
              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
            >
              +
            </button>
          </div>
          <div className="flex w-full items-center justify-between sm:hidden">
            <label className="sr-only" htmlFor={`quantity-${item.id}`}>
              {t("Quantity")} {title}
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
            {t("Remove")}
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
            {t("Remove")}
          </a>
        </div>
      </div>
    </div>
  );
}
