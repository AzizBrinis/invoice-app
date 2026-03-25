import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { HERO_BADGES } from "../../data/navigation";
import { HERO_IMAGE } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { Section } from "../layout/Section";

type HeroSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
};

export function HeroSection({
  theme,
  section,
  mediaLibrary = [],
}: HeroSectionProps) {
  const eyebrow = section?.eyebrow ?? "Handpicked trend";
  const title = section?.title ?? "Exclusive collection for everyone";
  const subtitle =
    section?.subtitle ??
    "Discover fresh styles and everyday essentials curated for every mood. Lorem ipsum dolor sit amet.";
  const note = section?.description ?? "Trusted by 32k+ shoppers worldwide";
  const badges =
    section?.items?.length
      ? section.items
          .map((item) => item.title)
          .filter((value): value is string => Boolean(value))
      : HERO_BADGES;
  const buttons = section?.buttons ?? [];
  const heroMedia = resolveBuilderMedia(section?.mediaId, mediaLibrary);
  const heroImage = HERO_IMAGE;
  const heroImageAlt = heroMedia?.alt ?? "Hero portrait";
  return (
    <Section
      theme={theme}
      id="hero"
      className="pb-5 pt-6 sm:pb-7 sm:pt-8"
      builderSectionId={section?.id}
    >
      <div
        className={clsx(
          "relative overflow-hidden bg-[var(--ciseco-hero)] px-5 py-7 sm:px-8 sm:py-8 lg:px-12 lg:py-10",
          theme.corner,
        )}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 -top-12 h-32 w-32 rounded-full bg-emerald-200/80 blur-2xl" />
          <div className="absolute left-8 top-6 h-3 w-3 rotate-12 rounded-sm bg-rose-400" />
          <div className="absolute right-8 top-10 h-5 w-5 rounded-full bg-orange-400/80 blur-[1px]" />
          <div className="absolute bottom-6 right-24 h-3 w-3 rotate-12 rounded-sm bg-emerald-500" />
        </div>
        <button
          type="button"
          aria-label="Previous slide"
          className="absolute left-4 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/80 text-slate-600 lg:flex"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M14 7l-5 5 5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next slide"
          className="absolute right-4 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/80 text-slate-600 lg:flex"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M10 7l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
        <div className="relative grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-10">
          <div className="space-y-4 lg:space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-700">
              {eyebrow}
            </span>
            <h1 className="max-w-[480px] text-[34px] font-semibold leading-[1.03] text-slate-900 sm:text-[52px] lg:text-[56px]">
              {title}
            </h1>
            <p className="max-w-[520px] text-sm text-slate-600 sm:text-base">
              {subtitle}
            </p>
            <div className="hidden flex-wrap gap-2 sm:flex lg:max-w-[500px]">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600"
                >
                  {badge}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {buttons[0] ? (
                <Button asChild className={clsx(theme.buttonShape, "bg-slate-900 px-6 text-white hover:opacity-90")}>
                  <a href={buttons[0].href ?? "#"}>{buttons[0].label}</a>
                </Button>
              ) : null}
              {buttons[1] ? (
                <a
                  href={buttons[1].href ?? "#"}
                  className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                >
                  {buttons[1].label}
                </a>
              ) : null}
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {note}
            </div>
          </div>
          <div className="relative ml-auto">
            <div className="absolute -left-2 top-6 h-4 w-4 rounded-full bg-rose-500" />
            <div className="absolute right-8 top-2 h-5 w-5 rounded-full bg-violet-400" />
            <div className="relative mx-auto flex h-[170px] w-[170px] items-center justify-center sm:h-[280px] sm:w-[280px] lg:h-[340px] lg:w-[340px]">
              <div className="absolute inset-0 rounded-full bg-[#9cb8ff] opacity-25" />
              <div className="absolute inset-[14%] rounded-full bg-white shadow-[0_35px_55px_-35px_rgba(15,23,42,0.32)]" />
              <img
                src={heroImage}
                alt={heroImageAlt}
                className="relative z-10 h-[75%] w-[75%] rounded-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
