import clsx from "clsx";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useCart } from "@/components/website/cart/cart-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type {
  WebsiteBuilderPageConfig,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { CatalogWebsiteSummary } from "@/server/website";
import { resolveBuilderSection } from "../builder-helpers";
import { ExtraSections } from "../components/builder/ExtraSections";
import { InfoBlocks } from "../components/order-success/InfoBlocks";
import {
  OrderItemsList,
  type OrderSuccessListItem,
} from "../components/order-success/OrderItemsList";
import { SuccessHeader } from "../components/order-success/SuccessHeader";
import { TotalsTable } from "../components/order-success/TotalsTable";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";
import { useCisecoLocation } from "../navigation";
import type { ThemeTokens } from "../types";

type OrderSuccessPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  slug: string;
  mode: "public" | "preview";
  ecommerceSettings: CatalogWebsiteSummary["ecommerceSettings"];
  builder?: WebsiteBuilderPageConfig | null;
};

type OrderSuccessOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  currency: string;
  paymentStatus: string;
  paymentMethod: string | null;
  customer: {
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    address: string | null;
  };
  subtotalHTCents: number;
  totalDiscountCents: number;
  totalTVACents: number;
  totalTTCCents: number;
  items: Array<{
    id: string;
    productId: string;
    title: string;
    productName: string | null;
    image: string | null;
    quantity: number;
    unitAmountCents: number | null;
    lineTotalCents: number | null;
  }>;
};

type OrderSuccessApiResponse =
  | { order: OrderSuccessOrder }
  | { error?: string };

type OrderSuccessState =
  | { status: "idle" }
  | { status: "ready"; order: OrderSuccessOrder; fetchKey: string }
  | { status: "error"; message: string; fetchKey: string };

type OrderSuccessViewState =
  | { status: "loading" }
  | { status: "empty"; orderNumber: string | null }
  | { status: "ready"; order: OrderSuccessOrder }
  | { status: "error"; message: string };

const mapPaymentMethodLabel = (value: string | null) => {
  switch (value) {
    case "card":
      return "Carte bancaire";
    case "bank_transfer":
      return "Virement bancaire";
    case "cash_on_delivery":
      return "Paiement à la livraison";
    default:
      return "Paiement à confirmer";
  }
};

const mapPaymentStatusLabel = (value: string) => {
  switch (value) {
    case "SUCCEEDED":
      return "Payé";
    case "AUTHORIZED":
      return "Autorisé";
    case "FAILED":
      return "Échoué";
    case "CANCELLED":
      return "Annulé";
    case "REFUNDED":
      return "Remboursé";
    default:
      return "En attente";
  }
};

const splitAddressLines = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

function OrderSuccessLoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-40 rounded-full bg-slate-200" />
      <div className="h-10 w-72 rounded-2xl bg-slate-200" />
      <div className="h-4 w-full max-w-xl rounded-full bg-slate-200" />
    </div>
  );
}

export function OrderSuccessPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  slug,
  mode,
  ecommerceSettings,
  builder,
}: OrderSuccessPageProps) {
  const { t } = useCisecoI18n();
  const { searchParams } = useCisecoLocation();
  const { clearCart } = useCart();
  const [state, setState] = useState<OrderSuccessState>({ status: "idle" });

  const orderId = searchParams.get("orderId");
  const orderNumber = searchParams.get("orderNumber");
  const token = searchParams.get("token");
  const currentFetchKey =
    orderId && token ? `${mode}:${slug}:${orderId}:${token}` : null;

  useEffect(() => {
    if (!currentFetchKey || !orderId || !token) {
      return;
    }

    let active = true;

    fetch(
      `/api/catalogue/orders/${encodeURIComponent(orderId)}?slug=${encodeURIComponent(slug)}&mode=${mode}&token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    )
      .then(async (response) => {
        const result = (await response.json()) as OrderSuccessApiResponse;
        if (!response.ok || !("order" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : "Impossible de charger votre commande.",
          );
        }
        if (!active) {
          return;
        }
        clearCart();
        setState({
          status: "ready",
          fetchKey: currentFetchKey,
          order: result.order,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setState({
          status: "error",
          fetchKey: currentFetchKey,
          message:
            error instanceof Error
              ? error.message
              : "Impossible de charger votre commande.",
        });
      });

    return () => {
      active = false;
    };
  }, [clearCart, currentFetchKey, mode, orderId, slug, token]);

  const viewState = useMemo<OrderSuccessViewState>(() => {
    if (!currentFetchKey) {
      return {
        status: "empty",
        orderNumber,
      };
    }
    if (state.status === "ready" && state.fetchKey === currentFetchKey) {
      return {
        status: "ready",
        order: state.order,
      };
    }
    if (state.status === "error" && state.fetchKey === currentFetchKey) {
      return {
        status: "error",
        message: state.message,
      };
    }
    return { status: "loading" };
  }, [currentFetchKey, orderNumber, state]);

  const resolvedCopy = useMemo(() => {
    if (viewState.status !== "ready") {
      return {
        eyebrow: "Confirmation",
        title: "Commande confirmée",
        message:
          "Votre commande a bien été enregistrée. Vous pouvez maintenant revenir au catalogue ou suivre les prochaines étapes depuis le message de confirmation.",
      };
    }

    const paymentMethod = viewState.order.paymentMethod;
    const paymentStatus = viewState.order.paymentStatus;
    if (paymentMethod === "card" && paymentStatus === "SUCCEEDED") {
      return {
        eyebrow: "Paiement confirmé",
        title: "Votre paiement a été validé",
        message:
          "Merci. Votre commande est enregistrée et votre paiement par carte a bien été confirmé.",
      };
    }
    if (paymentMethod === "bank_transfer") {
      return {
        eyebrow: "Commande confirmée",
        title: "Virement en attente",
        message:
          "Votre commande est enregistrée. Finalisez le règlement par virement bancaire en suivant les instructions ci-dessous.",
      };
    }
    if (paymentMethod === "cash_on_delivery") {
      return {
        eyebrow: "Commande confirmée",
        title: "Paiement à la livraison sélectionné",
        message:
          "Votre commande est enregistrée. Le règlement sera effectué au moment de la livraison.",
      };
    }
    return {
      eyebrow: "Commande confirmée",
      title: "Votre commande a bien été enregistrée",
      message:
        "Merci. Nous préparons maintenant votre commande et vous enverrons les prochaines étapes par e-mail.",
    };
  }, [viewState]);

  const orderMeta = useMemo(() => {
    if (viewState.status !== "ready") {
      return null;
    }
    return {
      reference: viewState.order.orderNumber,
      date: formatDate(viewState.order.createdAt, "fr-TN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }, [viewState]);

  const orderItems = useMemo<OrderSuccessListItem[]>(() => {
    if (viewState.status !== "ready") {
      return [];
    }
    return viewState.order.items.map((item) => ({
      id: item.id,
      name: item.title,
      detail:
        item.productName && item.productName !== item.title
          ? item.productName
          : null,
      price:
        item.unitAmountCents != null
          ? formatCurrency(
              fromCents(item.unitAmountCents, viewState.order.currency),
              viewState.order.currency,
            )
          : "--",
      quantity: item.quantity,
      image: item.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0],
    }));
  }, [viewState]);

  const totalsRows = useMemo(() => {
    if (viewState.status !== "ready") {
      return [];
    }
    const currency = viewState.order.currency;
    const rows = [
      {
        label: "Sous-total HT",
        value: formatCurrency(
          fromCents(viewState.order.subtotalHTCents, currency),
          currency,
        ),
      },
    ];
    if (viewState.order.totalDiscountCents > 0) {
      rows.push({
        label: "Remise",
        value: `-${formatCurrency(
          fromCents(viewState.order.totalDiscountCents, currency),
          currency,
        )}`,
      });
    }
    rows.push({
      label: "TVA",
      value: formatCurrency(
        fromCents(viewState.order.totalTVACents, currency),
        currency,
      ),
    });
    rows.push({
      label: "Livraison",
      value: formatCurrency(0, currency),
    });
    return rows;
  }, [viewState]);

  const shippingBlock = useMemo(() => {
    if (viewState.status !== "ready") {
      return {
        title: "Livraison",
        lines: ["Aucune adresse disponible."],
      };
    }
    const order = viewState.order;
    return {
      title: "Livraison",
      lines: [
        order.customer.company?.trim() || order.customer.name,
        ...(order.customer.company?.trim() ? [order.customer.name] : []),
        ...splitAddressLines(order.customer.address),
        order.customer.phone ? `Tél. ${order.customer.phone}` : "",
        order.customer.email,
      ].filter(Boolean),
    };
  }, [viewState]);

  const paymentBlock = useMemo(() => {
    if (viewState.status !== "ready") {
      return {
        title: "Paiement",
        lines: ["Aucune information de paiement disponible."],
      };
    }
    const order = viewState.order;
    const instructions =
      order.paymentMethod === "bank_transfer"
        ? ecommerceSettings?.payments?.bankTransfer?.instructions?.trim() ?? ""
        : "";
    return {
      title: "Paiement",
      badge: mapPaymentMethodLabel(order.paymentMethod),
      lines: [
        `Statut : ${mapPaymentStatusLabel(order.paymentStatus)}`,
        ...(instructions
          ? instructions
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : []),
      ],
    };
  }, [ecommerceSettings?.payments?.bankTransfer?.instructions, viewState]);

  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const consumedIds = new Set(
    [heroSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) => section.visible !== false && !consumedIds.has(section.id),
  );

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        <div
          className={clsx(
            "mx-auto px-6 pb-20 pt-8 sm:px-8 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          <div className="mx-auto max-w-[760px]">
            {viewState.status === "loading" ? (
              <OrderSuccessLoadingState />
            ) : (
              <SuccessHeader
                eyebrow={resolvedCopy.eyebrow}
                title={resolvedCopy.title}
                message={resolvedCopy.message}
              />
            )}

            {orderMeta ? (
              <div className="mt-8 grid gap-3 border-b border-black/5 pb-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Référence de commande</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {orderMeta.reference}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Date</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {orderMeta.date}
                  </p>
                </div>
              </div>
            ) : viewState.status === "empty" ? (
              <div className="mt-8 rounded-3xl border border-dashed border-black/10 bg-white/70 px-5 py-8 text-sm text-slate-600">
                {viewState.orderNumber ? (
                  <p>Référence de prévisualisation : {viewState.orderNumber}</p>
                ) : (
                  <p>
                    Aucun récapitulatif de commande disponible pour cette page.
                  </p>
                )}
              </div>
            ) : null}

            {viewState.status === "error" ? (
              <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                {viewState.message}
              </div>
            ) : null}

            {viewState.status === "ready" ? (
              <>
                <OrderItemsList items={orderItems} />
                <TotalsTable
                  rows={totalsRows}
                  total={formatCurrency(
                    fromCents(
                      viewState.order.totalTTCCents,
                      viewState.order.currency,
                    ),
                    viewState.order.currency,
                  )}
                />
                <InfoBlocks
                  shipping={shippingBlock}
                  payment={paymentBlock}
                />
              </>
            ) : null}

            <div className="mt-10 flex justify-end border-t border-black/5 pt-6">
              <a
                href={homeHref}
                className="flex w-fit items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:text-slate-900"
              >
                {t("Continue shopping")} <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
        </div>
        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}
