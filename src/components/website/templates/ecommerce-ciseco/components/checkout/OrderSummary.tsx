"use client";

import clsx from "clsx";
import type { CartLine } from "@/components/website/cart/cart-context";
import { useCart } from "@/components/website/cart/cart-context";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { CatalogImage } from "../shared/CatalogImage";

type OrderSummaryProps = {
  theme: ThemeTokens;
  isSubmitting: boolean;
  isSubmitDisabled: boolean;
  showPrices: boolean;
};

type OrderSummaryItemProps = {
  item: CartLine;
  showPrices: boolean;
  isSubmitting: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
};

export function OrderSummary({
  theme,
  isSubmitting,
  isSubmitDisabled,
  showPrices,
}: OrderSummaryProps) {
  const { t } = useCisecoI18n();
  const {
    items,
    totals,
    totalAmountCents,
    hasMissingPrices,
    isHydrated,
    updateItemQuantity,
    removeItem,
  } = useCart();

  const currencyCode = items[0]?.product.currencyCode || "TND";
  const subtotalCents = totals?.subtotalHTCents ?? null;
  const taxCents = totals?.totalTVACents ?? null;
  const totalCents = totalAmountCents ?? null;

  const formatCents = (amountCents: number | null) =>
    showPrices && amountCents != null
      ? formatCurrency(fromCents(amountCents, currencyCode), currencyCode)
      : "--";

  const subtotalLabel = formatCents(subtotalCents);
  const shippingLabel = showPrices ? formatCurrency(0, currencyCode) : "--";
  const taxLabel = formatCents(taxCents);
  const totalLabel = formatCents(totalCents);
  const warningMessage = !showPrices
    ? t("Pricing is hidden for this shop. Please contact us.")
    : hasMissingPrices
      ? t("Some items could not be priced. Remove them to continue.")
      : null;

  return (
    <aside className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {t("Order summary")}
      </h2>
      <div className="divide-y divide-black/5">
        {!isHydrated ? (
          <div className="py-5 text-sm text-slate-500">{t("Loading cart...")}</div>
        ) : items.length === 0 ? (
          <div className="py-5 text-sm text-slate-500">
            {t("Your cart is empty.")}
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
      <div className="space-y-4 border-t border-black/5 pt-6">
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>{t("Subtotal")}</span>
            <span className="font-semibold text-slate-900">
              {subtotalLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("Shipping estimate")}</span>
            <span className="font-semibold text-slate-900">
              {shippingLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("Tax estimate")}</span>
            <span className="font-semibold text-slate-900">{taxLabel}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-sm font-semibold text-slate-900">
            <span>{t("Order total")}</span>
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
        {isSubmitting ? t("Submitting...") : "Valider la commande"}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">
        Le récapitulatif est synchronisé avec le panier en temps réel et tient
        compte des options produit réellement sélectionnées.
      </p>
    </aside>
  );
}

function OrderSummaryItem({
  item,
  showPrices,
  isSubmitting,
  onDecrease,
  onIncrease,
  onRemove,
}: OrderSummaryItemProps) {
  const { t } = useCisecoI18n();
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
  const unitPriceLabel = showPrices
    ? effectiveUnitAmountCents != null
      ? formatCurrency(
          fromCents(effectiveUnitAmountCents, currencyCode),
          currencyCode,
        )
      : item.product.price || "--"
    : "--";
  const imageSrc = item.product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const title = t(item.product.title || "Item");

  return (
    <div className="flex gap-4 py-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-3 shadow-sm">
        <CatalogImage
          src={imageSrc}
          alt={title}
          className="h-full w-full object-cover"
          width={160}
          height={160}
          sizes="80px"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {optionsLabel ? (
              <p className="text-xs text-slate-500">{optionsLabel}</p>
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
              aria-label={`${t("Decrease quantity")} ${title}`}
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
              aria-label={`${t("Increase quantity")} ${title}`}
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
            {t("Remove")}
          </a>
        </div>
      </div>
    </div>
  );
}
