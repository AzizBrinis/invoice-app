import { CATEGORY_CARDS, CATEGORY_TABS } from "../../data/home";
import type { WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { CategoryIcon } from "../shared/Icons";
import { PillTabs } from "../shared/PillTabs";
import { Reveal } from "../shared/Reveal";
import { Section } from "../layout/Section";

type ExploreCategoriesSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  homeHref: string;
};

export function ExploreCategoriesSection({
  theme,
  section,
  homeHref,
}: ExploreCategoriesSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "Start exploring";
  const title = section?.title ?? "Browse key categories";
  const subtitle =
    section?.subtitle ??
    "A neutral category grid for products, services, or content.";
  const tabs =
    section?.buttons?.length
      ? section.buttons.map((button) => button.label)
      : CATEGORY_TABS;
  const cards =
    section?.items?.length
      ? section.items.map((item, index) => {
          const fallback = CATEGORY_CARDS[index];
          return {
            id: item.id,
            title: item.title ?? fallback?.title ?? "Category",
            description: item.description ?? fallback?.description ?? "",
            icon:
              (item.tag as
                | "workspace"
                | "planning"
                | "analytics"
                | "operations"
                | "support"
                | "resources") ??
              fallback?.icon ??
              "workspace",
            badge: item.badge ?? null,
            href: item.href ?? fallback?.href ?? "/collections",
          };
        })
      : CATEGORY_CARDS;
  return (
    <Section
      theme={theme}
      id="explore"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
    >
      <div className="rounded-[26px] bg-[#ebedf0] px-4 py-6 sm:px-6 sm:py-7">
        <div className="space-y-4 text-center">
          <p className="ciseco-home-eyebrow">
            {t(eyebrow)}
          </p>
          <h2 className="ciseco-home-title text-[34px] sm:text-[42px]">
            {t(title)}
          </h2>
          <p className="ciseco-home-subtitle mx-auto max-w-[660px]">
            {t(subtitle)}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <PillTabs items={tabs} activeIndex={0} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal key={card.id} delay={index * 70}>
              <a
                href={localizeHref(
                  resolveCisecoNavigationHref({
                    href: card.href,
                    homeHref,
                    fallbackPath: "/collections",
                  }),
                )}
                className="relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf3ff] text-[var(--site-accent)]">
                    <CategoryIcon name={card.icon} />
                  </div>
                  <div>
                    <p className="ciseco-card-title text-[15px] text-slate-900">
                      {t(card.title)}
                    </p>
                    <p className="text-[13px] leading-6 text-slate-500">
                      {t(card.description)}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
                  <span>{t(card.badge ?? "24+ entries")}</span>
                  <span className="text-[var(--site-accent)]">{t("Explore")}</span>
                </div>
                <div
                  className="pointer-events-none absolute -bottom-2 right-1 h-10 w-16 rotate-[-8deg] rounded-[40%] border border-emerald-200/90"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute -bottom-3 right-3 h-10 w-16 rotate-[-8deg] rounded-[40%] border border-pink-200/90"
                  aria-hidden="true"
                />
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
