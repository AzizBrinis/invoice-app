import { CATEGORY_CARDS, CATEGORY_TABS } from "../../data/home";
import type { WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { CategoryIcon } from "../shared/Icons";
import { PillTabs } from "../shared/PillTabs";
import { Reveal } from "../shared/Reveal";
import { Section } from "../layout/Section";

type ExploreCategoriesSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
};

export function ExploreCategoriesSection({
  theme,
  section,
}: ExploreCategoriesSectionProps) {
  const eyebrow = "Start exploring";
  const title = "Explore categories";
  const subtitle = "Discover all categories.";
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
                | "women"
                | "men"
                | "kids"
                | "beauty"
                | "sport"
                | "home") ??
              fallback?.icon ??
              "home",
            badge: item.badge ?? null,
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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-900">
            {eyebrow}
          </p>
          <h2 className="text-[30px] font-semibold leading-tight text-slate-900 sm:text-[34px]">
            {title}
          </h2>
          <p className="mx-auto max-w-[660px] text-sm text-slate-500">
            {subtitle}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <PillTabs items={tabs} activeIndex={0} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal key={card.id} delay={index * 70}>
              <div className="relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf3ff] text-[var(--site-accent)]">
                    <CategoryIcon name={card.icon} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {card.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {card.description}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
                  <span>{card.badge ?? "120+ items"}</span>
                  <span className="text-[var(--site-accent)]">Explore</span>
                </div>
                <div
                  className="pointer-events-none absolute -bottom-2 right-1 h-10 w-16 rotate-[-8deg] rounded-[40%] border border-emerald-200/90"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute -bottom-3 right-3 h-10 w-16 rotate-[-8deg] rounded-[40%] border border-pink-200/90"
                  aria-hidden="true"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
