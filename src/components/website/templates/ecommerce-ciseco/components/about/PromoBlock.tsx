import clsx from "clsx";
import type { ThemeTokens } from "../../types";
import { ABOUT_PROMO_COPY, ABOUT_PROMO_ILLUSTRATION } from "../../data/about";
import { useCisecoI18n } from "../../i18n";
import { resolveCisecoNavigationHref } from "../../utils";
import { Section } from "../layout/Section";

type PromoBlockProps = {
  theme: ThemeTokens;
  companyName: string;
  homeHref: string;
  title?: string | null;
  description?: string | null;
  buttons?: Array<{ label: string; href?: string | null }> | null;
  image?: { src: string; alt: string } | null;
  sectionId?: string;
};

export function PromoBlock({
  theme,
  companyName,
  homeHref,
  title,
  description,
  buttons,
  image,
  sectionId,
}: PromoBlockProps) {
  const { t, localizeHref } = useCisecoI18n();
  const resolvedTitle =
    title ?? ABOUT_PROMO_COPY.title.replaceAll("Ciseco", companyName);
  const resolvedDescription =
    description ?? ABOUT_PROMO_COPY.description.replaceAll("Ciseco", companyName);
  const resolvedButtons =
    buttons?.length
      ? buttons
      : [
          { label: ABOUT_PROMO_COPY.primaryCta, href: "#" },
          { label: ABOUT_PROMO_COPY.secondaryCta, href: "#" },
        ];
  const resolvedImage = image ?? {
    src: ABOUT_PROMO_ILLUSTRATION,
    alt: "Ciseco rewards illustration",
  };

  return (
    <Section theme={theme} id="promo" builderSectionId={sectionId}>
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <div className="text-lg font-semibold text-slate-900">
            {companyName}
            <span className="text-[var(--site-accent)]">.</span>
          </div>
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            {t(resolvedTitle)}
          </h2>
          <p className="text-sm text-slate-500">
            {t(resolvedDescription)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {resolvedButtons.slice(0, 2).map((button, index) => (
              <a
                key={`${button.label}-${index}`}
                href={localizeHref(
                  resolveCisecoNavigationHref({
                    href: button.href,
                    homeHref,
                    fallbackPath: index === 0 ? "/collections" : "/contact",
                  }),
                )}
                className={clsx(
                  theme.buttonShape,
                  index === 0
                    ? "bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                    : "border border-black/10 bg-white px-5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50",
                )}
              >
                {t(button.label)}
              </a>
            ))}
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md">
            <img
              src={resolvedImage.src}
              alt={t(resolvedImage.alt)}
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
