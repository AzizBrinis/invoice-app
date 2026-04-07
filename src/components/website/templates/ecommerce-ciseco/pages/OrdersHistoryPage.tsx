"use client";

import clsx from "clsx";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { AccountTabs } from "../components/account/AccountTabs";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";
import { formatCisecoDate } from "../locale";
import { useAccountProfile } from "../hooks/useAccountProfile";

type OrdersHistoryPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type OrderItem = {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: string;
  image: string;
};

type OrderHistory = {
  id: string;
  orderNumber: string;
  deliveredOn: string;
  items: OrderItem[];
};

const ORDER_HISTORY: OrderHistory[] = [
  {
    id: "4657",
    orderNumber: "#4657",
    deliveredOn: "2025-01-11",
    items: [
      {
        id: "nomad-tumbler",
        name: "Nomad Tumbler",
        variant: "Black Brown | XS",
        quantity: 1,
        price: "$35.00",
        image:
          "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=pad&w=400&h=400&q=80&bg=ffffff",
      },
      {
        id: "minimalist-wristwatch",
        name: "Minimalist Wristwatch",
        variant: "White | XL",
        quantity: 1,
        price: "$149.00",
        image:
          "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=pad&w=400&h=400&q=80&bg=ffffff",
      },
    ],
  },
  {
    id: "4376",
    orderNumber: "#4376",
    deliveredOn: "2028-01-08",
    items: [
      {
        id: "nomad-tumbler-blue",
        name: "Nomad Tumbler",
        variant: "Black | M",
        quantity: 1,
        price: "$99.00",
        image:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=pad&w=400&h=400&q=80&bg=ffffff",
      },
    ],
  },
];

const actionButtonClassName =
  "rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-200 hover:text-slate-900";

const priceBadgeClassName =
  "inline-flex items-center rounded-full border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-600 shadow-sm";

export function OrdersHistoryPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: OrdersHistoryPageProps) {
  const { t } = useCisecoI18n();
  const { profile, status: profileStatus } = useAccountProfile({
    redirectOnUnauthorized: true,
    loadStrategy: "mount",
  });
  const headerDetails = useMemo(() => {
    const parts = [profile.email, profile.address].filter(
      (value) => value && value.trim().length > 0,
    ) as string[];
    return parts.join(" · ");
  }, [profile.address, profile.email]);
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
    (section) =>
      section.visible !== false && !consumedIds.has(section.id),
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
              <OrderHistoryList orders={ORDER_HISTORY} />
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

function OrderHistoryList({ orders }: { orders: OrderHistory[] }) {
  return (
    <div className="mt-8 space-y-6">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: OrderHistory }) {
  const { t, locale } = useCisecoI18n();

  return (
    <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <header className="flex flex-col gap-4 border-b border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div>
          <p className="text-base font-semibold text-slate-900 sm:text-lg">
            {order.orderNumber}
          </p>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            {t("Delivered on")}{" "}
            {formatCisecoDate(locale, order.deliveredOn, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <a href="#" className={actionButtonClassName}>
            {t("Buy again")}
          </a>
          <a href="#" className={actionButtonClassName}>
            {t("View order")}
          </a>
        </div>
      </header>
      <div className="divide-y divide-black/5">
        {order.items.map((item) => (
          <OrderItemRow key={item.id} item={item} />
        ))}
      </div>
    </article>
  );
}

function OrderItemRow({ item }: { item: OrderItem }) {
  const { t } = useCisecoI18n();

  return (
    <div className="flex items-start gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-2 shadow-sm sm:h-20 sm:w-20">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-slate-900 sm:text-base">
            {item.name}
          </p>
          <p className="text-xs text-slate-500">{item.variant}</p>
          <p className="pt-3 text-xs text-slate-500">
            <span className="sm:hidden">x {item.quantity}</span>
            <span className="hidden sm:inline">
              {t("Qty")} {item.quantity}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right sm:gap-3">
          <span className={priceBadgeClassName}>{item.price}</span>
          <a
            href="#"
            className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
          >
            {t("Leave review")}
          </a>
        </div>
      </div>
    </div>
  );
}
