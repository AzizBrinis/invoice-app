import { FEATURE_ITEMS } from "../../data/home";
import type { WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { FeatureIcon } from "../shared/Icons";
import { Reveal } from "../shared/Reveal";
import { Section } from "../layout/Section";

type FeatureRowProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
};

export function FeatureRow({ theme, section }: FeatureRowProps) {
  const items =
    section?.items?.length
      ? section.items.map((item, index) => {
          const fallback = FEATURE_ITEMS[index];
          const icon =
            (item.tag as "shipping" | "return" | "secure" | "support") ??
            fallback?.icon ??
            "shipping";
          return {
            id: item.id,
            title: item.title ?? fallback?.title ?? "Feature",
            subtitle: item.description ?? fallback?.subtitle ?? "",
            icon,
          };
        })
      : FEATURE_ITEMS;
  return (
    <Section
      theme={theme}
      id="features"
      className="py-6"
      builderSectionId={section?.id}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <Reveal key={item.id} delay={index * 60}>
            <div className="rounded-2xl border border-black/5 bg-white px-4 py-5 text-center shadow-sm">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#f3f5fb] text-[var(--site-accent)]">
                <FeatureIcon name={item.icon} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.subtitle}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
