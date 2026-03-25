"use client";

import clsx from "clsx";
import type { CSSProperties } from "react";
import { useCart } from "@/components/website/cart/cart-context";
import { Button } from "@/components/ui/button";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { Breadcrumb } from "../components/cart/Breadcrumb";
import { CartItemRow } from "../components/cart/CartItemRow";
import { OrderSummary } from "../components/cart/OrderSummary";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { buildCisecoHref } from "../utils";

type CartPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

const CHECKOUT_PATH = "/checkout";

function CartEmptyState({
  theme,
  homeHref,
}: {
  theme: ThemeTokens;
  homeHref: string;
}) {
  const safeHomeHref = homeHref || "/";
  return (
    <div className="flex flex-col items-start gap-3 py-10 text-sm text-slate-600">
      <p className="text-base font-semibold text-slate-900">
        Your cart is empty
      </p>
      <p>Browse the shop to add items and start checkout.</p>
      <Button
        asChild
        className={clsx(
          theme.buttonShape,
          "bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900/30",
        )}
      >
        <a href={safeHomeHref}>Back to shop</a>
      </Button>
    </div>
  );
}

function CartLoadingState() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.42fr)]">
      <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 px-6 py-10 text-sm text-slate-500">
        Loading cart...
      </div>
      <div className="pt-8 lg:border-l lg:border-black/5 lg:pl-10 lg:pt-2">
        <div className="rounded-3xl border border-dashed border-black/10 bg-white/70 px-6 py-10 text-sm text-slate-500">
          Preparing summary...
        </div>
      </div>
    </div>
  );
}

function CartPageContent({
  theme,
  homeHref,
  checkoutHref,
}: {
  theme: ThemeTokens;
  homeHref: string;
  checkoutHref: string;
}) {
  const { items, isHydrated } = useCart();
  const isEmpty = items.length === 0;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.42fr)]">
      <div className="divide-y divide-black/5 border-b border-black/5">
        {!isHydrated ? (
          <div className="py-10 text-sm text-slate-500">Loading cart...</div>
        ) : isEmpty ? (
          <CartEmptyState theme={theme} homeHref={homeHref} />
        ) : (
          items.map((item) => <CartItemRow key={item.id} item={item} />)
        )}
      </div>
      <div className="pt-8 lg:border-l lg:border-black/5 lg:pl-10 lg:pt-2">
        <OrderSummary theme={theme} checkoutHref={checkoutHref} />
      </div>
    </div>
  );
}

// Smoke test checklist:
// - Add items from home/product and see them listed with TND prices.
// - Update quantities via +/- and mobile select; totals change instantly.
// - Remove items, refresh, and confirm cart state persists.
export function CartPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: CartPageProps) {
  const { isHydrated } = useCart();
  const checkoutHref = buildCisecoHref(homeHref, CHECKOUT_PATH);
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
            "mx-auto px-6 pb-16 pt-8 sm:px-8 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              {heroSection?.title ?? "Shopping Cart"}
            </h1>
            {heroSubtitle ? (
              <p className="text-sm text-slate-600">{heroSubtitle}</p>
            ) : null}
            <Breadcrumb
              items={[
                { label: "Home", href: homeHref },
                { label: "Shopping Cart" },
              ]}
            />
          </div>
          <div className="mt-8 border-t border-black/5 pt-8">
            {isHydrated ? (
              <CartPageContent
                theme={theme}
                homeHref={homeHref}
                checkoutHref={checkoutHref}
              />
            ) : (
              <CartLoadingState />
            )}
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
