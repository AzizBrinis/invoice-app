"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { useCart } from "@/components/website/cart/cart-context";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type { ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";

type OrderSummaryProps = {
  theme: ThemeTokens;
  checkoutHref: string;
};

const CURRENCY_CODE = "TND";

export function OrderSummary({ theme, checkoutHref }: OrderSummaryProps) {
  const { t, localizeHref } = useCisecoI18n();
  const { items, isHydrated } = useCart();
  const { subtotalCents, hasMissingAmounts } = useMemo(() => {
    if (!items.length) {
      return { subtotalCents: 0, hasMissingAmounts: false };
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
    };
  }, [items]);
  const shippingCents = 0;
  const taxCents = 0;
  const totalCents =
    subtotalCents == null ? null : subtotalCents + shippingCents + taxCents;
  const isCheckoutDisabled =
    !isHydrated || items.length === 0 || subtotalCents == null;
  const formatCents = (amountCents: number | null) =>
    amountCents == null
      ? "--"
      : formatCurrency(fromCents(amountCents, CURRENCY_CODE), CURRENCY_CODE);
  const subtotalLabel = isHydrated ? formatCents(subtotalCents) : "--";
  const shippingLabel = formatCurrency(0, CURRENCY_CODE);
  const taxLabel = formatCurrency(0, CURRENCY_CODE);
  const totalLabel = isHydrated ? formatCents(totalCents) : "--";
  const warningMessage =
    isHydrated && hasMissingAmounts
      ? t("Some items could not be priced. Remove them to continue.")
      : null;

  return (
    <aside className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">{t("Order Summary")}</h2>
      <div className="divide-y divide-black/5 text-sm text-slate-600">
        <div className="flex items-center justify-between py-2">
          <span>{t("Subtotal")}</span>
          <span className="font-semibold text-slate-900">
            {subtotalLabel}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span>{t("Shipping estimate")}</span>
          <span className="font-semibold text-slate-900">
            {shippingLabel}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span>{t("Tax estimate")}</span>
          <span className="font-semibold text-slate-900">
            {taxLabel}
          </span>
        </div>
        <div className="flex items-center justify-between py-3 font-semibold text-slate-900">
          <span>{t("Order total")}</span>
          <span>{totalLabel}</span>
        </div>
      </div>
      {warningMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {warningMessage}
        </div>
      ) : null}
      {isCheckoutDisabled ? (
        <Button
          type="button"
          className={clsx(
            theme.buttonShape,
            "w-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900/30",
          )}
          disabled
        >
          {t("Checkout")}
        </Button>
      ) : (
        <Button
          asChild
          className={clsx(
            theme.buttonShape,
            "w-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900/30",
          )}
        >
          <a href={localizeHref(checkoutHref)}>{t("Checkout")}</a>
        </Button>
      )}
      <p className="flex flex-wrap items-center justify-center gap-1 text-center text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
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
          {t("Learn more")}
        </span>
        <a
          href="#"
          className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2"
        >
          {t("Taxes")}
        </a>
        <span>{t("and")}</span>
        <a
          href="#"
          className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2"
        >
          {t("Shipping")}
        </a>
        <span>{t("information")}</span>
      </p>
    </aside>
  );
}
