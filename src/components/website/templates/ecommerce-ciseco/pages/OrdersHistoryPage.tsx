"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type {
  WebsiteBuilderPageConfig,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import {
  buildAccountOrdersHref,
  type AccountOrderListItem,
  type AccountOrdersListResponse,
  parsePositiveInteger,
  resolveAccountBasePath,
  resolveCatalogueSlugFromPathname,
  resolveOrderStatusBadgeClass,
  resolveOrderStatusLabel,
  resolvePaymentStatusBadgeClass,
  resolvePaymentStatusLabel,
} from "../account-orders";
import { buildPaginationSequence } from "../collections";
import { AccountTabs } from "../components/account/AccountTabs";
import { ExtraSections } from "../components/builder/ExtraSections";
import { PaginationBar } from "../components/collections/PaginationBar";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { CatalogImage } from "../components/shared/CatalogImage";
import { useAccountProfile } from "../hooks/useAccountProfile";
import { useCisecoI18n } from "../i18n";
import { formatCisecoDate, type CisecoLocale } from "../locale";
import { useCisecoLocation } from "../navigation";

type OrdersHistoryPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type OrdersState =
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; data: AccountOrdersListResponse }
  | { status: "error"; requestKey: string; message: string };

const actionButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-200 hover:text-slate-900";

const statusBadgeBaseClassName =
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm";

export function OrdersHistoryPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: OrdersHistoryPageProps) {
  const { t, locale, localizeHref } = useCisecoI18n();
  const { pathname, searchParams } = useCisecoLocation();
  const basePath = useMemo(() => resolveAccountBasePath(pathname), [pathname]);
  const slug = useMemo(
    () => resolveCatalogueSlugFromPathname(pathname),
    [pathname],
  );
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const {
    profile,
    status: profileStatus,
    clearProfile,
  } = useAccountProfile({
    redirectOnUnauthorized: true,
    loadStrategy: "mount",
  });
  const [reloadKey, setReloadKey] = useState(0);

  const headerDetails = useMemo(() => {
    const parts = [profile.email, profile.address].filter(
      (value) => value && value.trim().length > 0,
    ) as string[];
    return parts.join(" · ");
  }, [profile.address, profile.email]);

  const requestHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (slug) {
      params.set("slug", slug);
    }
    return `/api/catalogue/orders?${params.toString()}`;
  }, [page, slug]);
  const requestKey = `${requestHref}:${reloadKey}`;
  const [ordersState, setOrdersState] = useState<OrdersState>(() => ({
    status: "loading",
    requestKey,
  }));

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetch(requestHref, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as
          | AccountOrdersListResponse
          | { error?: string };

        if (!active) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          clearProfile();
          return;
        }

        if (!response.ok || !("orders" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : t("Unable to load orders."),
          );
        }

        setOrdersState({
          status: "ready",
          requestKey,
          data: result,
        });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        setOrdersState({
          status: "error",
          requestKey,
          message:
            error instanceof Error
              ? error.message
              : t("Unable to load orders."),
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [clearProfile, requestHref, requestKey, t]);

  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const consumedIds = new Set(
    [heroSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) => section.visible !== false && !consumedIds.has(section.id),
  );

  const viewState =
    ordersState.requestKey === requestKey
      ? ordersState
      : { status: "loading" as const, requestKey };
  const pagination =
    viewState.status === "ready" ? viewState.data.pagination : null;
  const paginationPages = pagination
    ? buildPaginationSequence(pagination.page, pagination.pageCount)
    : [];

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
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {t(heroSection?.title ?? "Account")}
              </h1>
              {heroSubtitle ? (
                <p className="text-sm text-slate-600">{t(heroSubtitle)}</p>
              ) : null}
              <p className="text-sm text-slate-500 sm:text-base">
                <span className="font-semibold text-slate-900">
                  {profile.name ||
                    (profileStatus === "loading" ? t("Loading...") : "—")}
                </span>
                {headerDetails
                  ? `, ${headerDetails}`
                  : profileStatus === "loading"
                    ? ` · ${t("Loading details...")}`
                    : null}
              </p>
            </div>
            <div className="mt-6 border-y border-black/5">
              <AccountTabs activeTab="Orders history" />
            </div>
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {t("Order history")}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {t(
                  "Check the status of recent orders, manage returns, and discover similar products.",
                )}
              </p>
              {viewState.status === "loading" ? (
                <OrdersLoadingState />
              ) : null}
              {viewState.status === "error" ? (
                <OrdersErrorState
                  message={viewState.message}
                  onRetry={() => setReloadKey((current) => current + 1)}
                />
              ) : null}
              {viewState.status === "ready" &&
              viewState.data.orders.length === 0 ? (
                <OrdersEmptyState
                  browseHref={localizeHref(homeHref)}
                  title={t("No orders yet")}
                  description={t(
                    "Your future orders will appear here as soon as they are confirmed.",
                  )}
                />
              ) : null}
              {viewState.status === "ready" &&
              viewState.data.orders.length > 0 ? (
                <>
                  <div className="mt-8 space-y-6">
                    {viewState.data.orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        locale={locale}
                        viewHref={localizeHref(
                          buildAccountOrdersHref({
                            basePath,
                            orderId: order.id,
                          }),
                        )}
                      />
                    ))}
                  </div>
                  {pagination ? (
                    <PaginationBar
                      currentPage={pagination.page}
                      pageCount={pagination.pageCount}
                      pages={paginationPages}
                      hrefForPage={(targetPage) =>
                        localizeHref(
                          buildAccountOrdersHref({
                            basePath,
                            page: targetPage,
                            status: viewState.data.filters.status,
                          }),
                        )
                      }
                    />
                  ) : null}
                </>
              ) : null}
            </section>
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

function OrdersLoadingState() {
  return (
    <div className="mt-8 space-y-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`orders-loading-${index + 1}`}
          className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-4 border-b border-black/5 px-4 py-4 sm:px-6 sm:py-5">
            <div className="h-5 w-32 rounded-full bg-slate-200" />
            <div className="h-4 w-56 rounded-full bg-slate-100" />
          </div>
          <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
            {Array.from({ length: 2 }).map((__, itemIndex) => (
              <div
                key={`orders-loading-item-${itemIndex + 1}`}
                className="flex items-start gap-4"
              >
                <div className="h-16 w-16 rounded-2xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded-full bg-slate-200" />
                  <div className="h-3 w-28 rounded-full bg-slate-100" />
                </div>
                <div className="h-6 w-20 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersEmptyState({
  title,
  description,
  browseHref,
}: {
  title: string;
  description: string;
  browseHref: string;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-black/10 bg-slate-50/70 px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {description}
      </p>
      <a href={browseHref} className={`${actionButtonClassName} mt-5`}>
        Retour a la boutique
      </a>
    </div>
  );
}

function OrdersErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-6">
      <p className="text-sm font-semibold text-rose-700">
        Impossible de charger vos commandes
      </p>
      <p className="mt-2 text-sm text-rose-600">{message}</p>
      <button type="button" onClick={onRetry} className={`${actionButtonClassName} mt-4`}>
        Reessayer
      </button>
    </div>
  );
}

function OrderCard({
  order,
  locale,
  viewHref,
}: {
  order: AccountOrderListItem;
  locale: CisecoLocale;
  viewHref: string;
}) {
  const outstandingCents = Math.max(0, order.totalTTCCents - order.amountPaidCents);

  return (
    <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-black/5 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900 sm:text-lg">
              {order.orderNumber}
            </p>
            <span
              className={clsx(
                statusBadgeBaseClassName,
                resolveOrderStatusBadgeClass(order.status),
              )}
            >
              {resolveOrderStatusLabel(order.status)}
            </span>
            <span
              className={clsx(
                statusBadgeBaseClassName,
                resolvePaymentStatusBadgeClass(order.paymentStatus),
              )}
            >
              {resolvePaymentStatusLabel(order.paymentStatus)}
            </span>
          </div>
          <p className="text-xs text-slate-500 sm:text-sm">
            Commande passee le{" "}
            {formatCisecoDate(locale, order.createdAt, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span>{order.itemCount} article(s)</span>
            <span>
              Total{" "}
              <span className="font-semibold text-slate-900">
                {formatCurrency(
                  fromCents(order.totalTTCCents, order.currency),
                  order.currency,
                )}
              </span>
            </span>
            {outstandingCents > 0 ? (
              <span>
                Reste a payer{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(
                    fromCents(outstandingCents, order.currency),
                    order.currency,
                  )}
                </span>
              </span>
            ) : null}
          </div>
        </div>
        <a href={viewHref} className={actionButtonClassName}>
          Voir le detail
        </a>
      </header>
      <div className="divide-y divide-black/5">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5"
          >
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-2 shadow-sm sm:h-20 sm:w-20">
              {item.image ? (
                <CatalogImage
                  src={item.image}
                  alt={item.productName ?? item.title}
                  className="h-full w-full object-cover"
                  width={80}
                  height={80}
                />
              ) : (
                <div className="h-full w-full rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
              )}
            </div>
            <div className="flex flex-1 items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-slate-900 sm:text-base">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500">
                  Quantite {item.quantity}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {formatCurrency(
                    fromCents(item.lineTotalCents, order.currency),
                    order.currency,
                  )}
                </p>
                {item.unitAmountCents != null ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {formatCurrency(
                      fromCents(item.unitAmountCents, order.currency),
                      order.currency,
                    )}{" "}
                    / unite
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {order.hasMoreItems ? (
        <div className="border-t border-black/5 px-4 py-3 text-xs text-slate-500 sm:px-6">
          D&apos;autres articles sont disponibles dans le detail de la commande.
        </div>
      ) : null}
    </article>
  );
}
