import clsx from "clsx";
import type { CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import {
  ORDER_SUCCESS_ITEMS,
  ORDER_SUCCESS_PAYMENT,
  ORDER_SUCCESS_SHIPPING,
  ORDER_SUCCESS_TOTALS,
} from "../data/order-success";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { InfoBlocks } from "../components/order-success/InfoBlocks";
import { OrderItemsList } from "../components/order-success/OrderItemsList";
import { SuccessHeader } from "../components/order-success/SuccessHeader";
import { TotalsTable } from "../components/order-success/TotalsTable";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";

type OrderSuccessPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

export function OrderSuccessPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: OrderSuccessPageProps) {
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
          <div className="mx-auto max-w-[720px]">
            <SuccessHeader
              eyebrow={heroSection?.eyebrow ?? "Thanks for ordering"}
              title={heroSection?.title ?? "Payment successful!"}
              message={
                heroSubtitle ??
                "We appreciate your order, we're currently processing it. So hang tight and we'll send you confirmation very soon!"
              }
            />
            <div className="mt-8 space-y-2 border-b border-black/5 pb-6">
              <p className="text-sm text-slate-500">Tracking number</p>
              <a
                href="#"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition hover:text-slate-700"
              >
                <span>#4657</span>
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
            <OrderItemsList items={ORDER_SUCCESS_ITEMS} />
            <TotalsTable totals={ORDER_SUCCESS_TOTALS} />
            <InfoBlocks
              shipping={ORDER_SUCCESS_SHIPPING}
              payment={ORDER_SUCCESS_PAYMENT}
            />
            <div className="mt-10 flex justify-end border-t border-black/5 pt-6">
              <a
                href={homeHref}
                className="flex w-fit items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:text-slate-900"
              >
                Continue shopping <span aria-hidden="true">&rarr;</span>
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
      <Footer theme={theme} companyName={companyName} />
    </PageShell>
  );
}
