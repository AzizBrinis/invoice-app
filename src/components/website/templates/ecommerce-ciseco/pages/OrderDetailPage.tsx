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
import { useAccountProfile } from "../hooks/useAccountProfile";

type OrderDetailPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type OrderItemDetail = {
  id: string;
  name: string;
  quantity: number;
  price: string;
  image: string;
  status: string;
  currentStep: number;
};

const ORDER_STEPS = ["Order placed", "Processing", "Shipped", "Delivered"];

const ORDER_ITEMS: OrderItemDetail[] = [
  {
    id: "nomad-tumbler",
    name: "Nomad Tumbler",
    quantity: 1,
    price: "$35.00",
    image:
      "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=pad&w=500&h=500&q=80&bg=ffffff",
    status: "Preparing to ship on March 24, 2021",
    currentStep: 1,
  },
  {
    id: "minimalist-wristwatch",
    name: "Minimalist Wristwatch",
    quantity: 1,
    price: "$149.00",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=pad&w=500&h=500&q=80&bg=ffffff",
    status: "Shipped on March 23, 2021",
    currentStep: 2,
  },
];

const deliveryAddress = [
  "Floyd Miles",
  "7363 Cynthia Pass",
  "Toronto, ON N3Y 4H8",
];

const shippingUpdates = {
  email: "f\u2022\u2022\u2022@example.com",
  phone: "1\u2022\u2022\u2022\u2022\u2022\u202240",
};

const totals = [
  { label: "Subtotal", value: "$72" },
  { label: "Shipping", value: "$5" },
  { label: "Tax", value: "$6.16" },
];

const actionButtonClassName =
  "rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-200 hover:text-slate-900";

const priceBadgeClassName =
  "inline-flex items-center rounded-full border border-emerald-500 px-3 py-1 text-[11px] font-semibold text-emerald-600 shadow-sm";

export function OrderDetailPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: OrderDetailPageProps) {
  const { profile, status: profileStatus } = useAccountProfile({
    redirectOnUnauthorized: true,
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
            <AccountHeader
              name={profile.name}
              details={headerDetails}
              status={profileStatus}
              title={heroSection?.title}
              subtitle={heroSubtitle}
            />
            <div className="mt-6 border-y border-black/5">
              <AccountTabs activeTab="Orders history" />
            </div>
            <OrderHeader />
            <div className="mt-6 space-y-6">
              {ORDER_ITEMS.map((item) => (
                <OrderItemCard key={item.id} item={item} />
              ))}
            </div>
            <div className="mt-8">
              <OrderSummaryCard />
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
      <Footer theme={theme} companyName={companyName} />
    </PageShell>
  );
}

function AccountHeader({
  name,
  details,
  status,
  title,
  subtitle,
}: {
  name: string;
  details: string;
  status: "loading" | "ready" | "error";
  title?: string | null;
  subtitle?: string | null;
}) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
        {title ?? "Account"}
      </h1>
      {subtitle ? (
        <p className="text-sm text-slate-600">{subtitle}</p>
      ) : null}
      <p className="text-sm text-slate-500 sm:text-base">
        <span className="font-semibold text-slate-900">
          {name || (status === "loading" ? "Loading..." : "—")}
        </span>
        {details
          ? `, ${details}`
          : status === "loading"
            ? " · Loading details..."
            : null}
      </p>
    </div>
  );
}

function OrderHeader() {
  return (
    <div className="mt-8 space-y-2">
      <p className="text-xs text-slate-500">Order placed March 22, 2025</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Order #4657
        </h2>
        <a href="#" className={actionButtonClassName}>
          View invoice <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  );
}

function OrderItemCard({ item }: { item: OrderItemDetail }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <div className="mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center rounded-2xl bg-slate-100 p-6 shadow-sm sm:mx-0 sm:h-24 sm:w-24 sm:max-w-none sm:p-3">
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900 sm:text-base">
                {item.name}
              </p>
              <p className="text-xs text-slate-500">Qty {item.quantity}</p>
              <span className={priceBadgeClassName}>{item.price}</span>
            </div>
            <div className="grid gap-4 text-xs text-slate-500 sm:min-w-[260px] sm:grid-cols-2 sm:gap-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900">
                  Delivery address
                </p>
                <div className="space-y-1">
                  {deliveryAddress.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900">
                  Shipping updates
                </p>
                <div className="space-y-1">
                  <p>{shippingUpdates.email}</p>
                  <p>{shippingUpdates.phone}</p>
                </div>
                <a
                  href="#"
                  className="inline-flex items-center text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                >
                  Edit <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-black/5 px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <p className="text-xs font-semibold text-slate-900 sm:text-sm">
          {item.status}
        </p>
        <ProgressTracker currentStep={item.currentStep} />
      </div>
    </article>
  );
}

function ProgressTracker({ currentStep }: { currentStep: number }) {
  const clampedStep = Math.min(Math.max(currentStep, 0), ORDER_STEPS.length - 1);
  const progress = (clampedStep / (ORDER_STEPS.length - 1)) * 100;

  return (
    <div className="mt-4">
      <div className="relative h-1 w-full rounded-full bg-slate-200">
        <span
          className="absolute left-0 top-0 h-1 rounded-full bg-slate-900"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
        {ORDER_STEPS.map((step, index) => {
          const isCurrent = index === clampedStep;
          const isDone = index < clampedStep;
          return (
            <span
              key={step}
              className={clsx(
                "text-left",
                isCurrent
                  ? "font-semibold text-slate-900"
                  : isDone
                    ? "text-slate-700"
                    : "text-slate-400",
              )}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function OrderSummaryCard() {
  return (
    <article className="rounded-2xl border border-black/5 bg-slate-50/70 px-5 py-6 shadow-sm sm:px-6">
      <div className="grid gap-6 sm:gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.75fr)]">
        <div className="space-y-2 text-xs text-slate-500">
          <p className="text-xs font-semibold text-slate-900">Billing address</p>
          <div className="space-y-1">
            {deliveryAddress.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div className="space-y-3 text-xs text-slate-500">
          <p className="text-xs font-semibold text-slate-900">
            Payment information
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
              Visa
            </span>
            <span className="text-xs text-slate-500">Ending with 4242</span>
          </div>
          <p>Expires 02 / 24</p>
        </div>
        <div className="space-y-2 text-xs text-slate-500">
          {totals.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span>{row.label}</span>
              <span className="font-semibold text-slate-900">
                {row.value}
              </span>
            </div>
          ))}
          <div className="my-3 border-t border-black/5" />
          <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>Order total</span>
            <span>$83.16</span>
          </div>
        </div>
      </div>
    </article>
  );
}
