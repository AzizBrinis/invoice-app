import { DEPARTMENTS } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";
import { Reveal } from "../shared/Reveal";

type DepartmentsSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  homeHref: string;
};

export function DepartmentsSection({
  theme,
  section,
  mediaLibrary = [],
  homeHref,
}: DepartmentsSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "Browse sections";
  const title = section?.title ?? "Explore example groupings";
  const subtitle =
    section?.subtitle ??
    "Organize content into flexible groups that work for any business.";
  const items =
    section?.items?.length
      ? section.items.map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          const fallback = DEPARTMENTS[index];
          return {
            id: item.id,
            title: item.title ?? fallback?.title ?? "Department",
            subtitle: item.description ?? fallback?.subtitle ?? "",
            image: asset?.src ?? fallback?.image ?? "",
            href: item.href ?? fallback?.href ?? "/collections",
          };
        })
      : DEPARTMENTS;
  return (
    <Section
      theme={theme}
      id="departments"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="ciseco-home-eyebrow">
            {t(eyebrow)}
          </p>
          <h2 className="ciseco-home-title text-[34px] sm:text-[42px]">
            {t(title)}
          </h2>
          <p className="ciseco-home-subtitle">
            {t(subtitle)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <Reveal key={item.id} delay={index * 60}>
              <a
                href={localizeHref(
                  resolveCisecoNavigationHref({
                    href: item.href,
                    homeHref,
                    fallbackPath: "/collections",
                  }),
                )}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={item.image}
                    alt={t(item.title)}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div>
                  <p className="ciseco-card-title text-[15px] text-slate-900">
                    {t(item.title)}
                  </p>
                  <p className="text-[13px] leading-6 text-slate-500">{t(item.subtitle)}</p>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
