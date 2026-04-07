"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  CartLine,
} from "@/components/website/cart/cart-context";
import { useCart } from "@/components/website/cart/cart-context";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import { useCisecoI18n } from "../../i18n";

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  cartHref: string;
  checkoutHref: string;
};

const QUANTITY_OPTIONS = [1, 2, 3, 4];
const FALLBACK_CURRENCY_CODE = "TND";
const resolveQuantityOptions = (quantity: number) => {
  if (quantity <= QUANTITY_OPTIONS[QUANTITY_OPTIONS.length - 1]) {
    return QUANTITY_OPTIONS;
  }
  return [...QUANTITY_OPTIONS, quantity].sort((left, right) => left - right);
};

const formatLinePrice = (item: CartLine) => {
  const code = item.product.currencyCode || FALLBACK_CURRENCY_CODE;
  const effectiveUnitAmountCents =
    item.lineTotalCents != null
      ? Math.round(item.lineTotalCents / item.quantity)
      : item.product.unitAmountCents;
  if (effectiveUnitAmountCents != null) {
    return formatCurrency(fromCents(effectiveUnitAmountCents, code), code);
  }
  return item.product.price || "--";
};

function CartDrawerItem({ item }: { item: CartLine }) {
  const { t } = useCisecoI18n();
  const { updateItemQuantity, removeItem } = useCart();
  const quantityOptions = resolveQuantityOptions(item.quantity);
  const selectedOptions = item.product.selectedOptions ?? [];
  const optionsLabel = selectedOptions.length
    ? selectedOptions
        .map((option) => `${t(option.name)}: ${t(option.value)}`)
        .join(" · ")
    : null;
  const imageSrc =
    item.product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const title = t(item.product.title || "Item");
  const unitPriceLabel = formatLinePrice(item);

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-3 py-5 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-4">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-2 sm:h-20 sm:w-20">
        <img
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
          {title}
        </p>
        {optionsLabel ? (
          <p className="mt-1 text-xs text-slate-400">{optionsLabel}</p>
        ) : null}
        <div className="mt-3">
          <label className="sr-only" htmlFor={`drawer-qty-${item.id}`}>
            {t("Quantity")} {title}
          </label>
          <select
            id={`drawer-qty-${item.id}`}
            value={item.quantity}
            onChange={(event) => {
              const nextQuantity = Number(event.target.value);
              if (!Number.isFinite(nextQuantity)) return;
              updateItemQuantity(item.id, nextQuantity);
            }}
            className="h-9 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm sm:text-sm"
          >
            {quantityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col items-end gap-3">
        <span className="rounded-full border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-600">
          {unitPriceLabel}
        </span>
        <button
          type="button"
          className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
          onClick={() => removeItem(item.id)}
        >
          {t("Remove")}
        </button>
      </div>
    </div>
  );
}

export function CartDrawer({
  open,
  onClose,
  cartHref,
  checkoutHref,
}: CartDrawerProps) {
  const { t, localizeHref } = useCisecoI18n();
  const { items, isHydrated } = useCart();
  const [mounted, setMounted] = useState(false);

  const { subtotalCents, hasMissingAmounts, currencyCode } = useMemo(() => {
    if (!items.length) {
      return {
        subtotalCents: 0,
        hasMissingAmounts: false,
        currencyCode: FALLBACK_CURRENCY_CODE,
      };
    }
    let subtotal = 0;
    let missing = false;
    items.forEach((item) => {
      const lineTotal =
        item.lineTotalCents ??
        (item.product.unitAmountCents != null
          ? item.product.unitAmountCents * item.quantity
          : null);
      if (lineTotal == null) {
        missing = true;
        return;
      }
      subtotal += lineTotal;
    });
    return {
      subtotalCents: missing ? null : subtotal,
      hasMissingAmounts: missing,
      currencyCode: items[0]?.product.currencyCode || FALLBACK_CURRENCY_CODE,
    };
  }, [items]);

  const subtotalLabel = useMemo(() => {
    if (!isHydrated || subtotalCents == null) return "--";
    return formatCurrency(fromCents(subtotalCents, currencyCode), currencyCode);
  }, [currencyCode, isHydrated, subtotalCents]);

  const isCheckoutDisabled =
    !isHydrated || items.length === 0 || subtotalCents == null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!mounted || !open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mounted, open]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={clsx(
          "fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={clsx(
          "fixed inset-y-0 right-0 z-[100] flex w-full max-w-[460px] flex-col bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-5 sm:px-6">
          <h2
            id="cart-drawer-title"
            className="text-2xl font-semibold text-slate-900 sm:text-xl"
          >
            {t("Shopping Cart")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close cart")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6l-12 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6">
          {!isHydrated ? (
            <div className="py-10 text-sm text-slate-500">{t("Loading cart...")}</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <p className="text-base font-semibold text-slate-900">
                {t("Your cart is empty")}
              </p>
              <p className="mt-2">
                {t("Add items to see them here and start checkout.")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/10">
              {items.map((item) => (
                <CartDrawerItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-black/10 px-5 py-5 sm:px-6">
          {hasMissingAmounts ? (
            <p className="mb-3 text-xs text-amber-700">
              {t("Some items could not be priced. Remove them to continue.")}
            </p>
          ) : null}
          <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>{t("Subtotal")}</span>
            <span>{subtotalLabel}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t("Shipping and taxes calculated at checkout.")}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href={localizeHref(cartHref)}
              className="flex-1 rounded-full border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={onClose}
            >
              {t("View cart")}
            </a>
            {isCheckoutDisabled ? (
              <button
                type="button"
                className="flex-1 cursor-not-allowed rounded-full bg-slate-300 px-4 py-3 text-sm font-semibold text-white"
                disabled
              >
                {t("Check out")}
              </button>
            ) : (
              <a
                href={localizeHref(checkoutHref)}
                className="flex-1 rounded-full bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                onClick={onClose}
              >
                {t("Check out")}
              </a>
            )}
          </div>
          <button
            type="button"
            className="mt-4 w-full text-center text-xs font-semibold tracking-[0.18em] text-slate-500 transition hover:text-slate-700"
            onClick={onClose}
          >
            {t("or CONTINUE SHOPPING →")}
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}
