"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import {
  clampHomeHeroSliderInterval,
  resolveHomeHeroContentBackground,
  resolveHomeHeroSlideContentBackground,
  resolveHomeHeroSliderMode,
  type HomeHeroContentBackground,
  type WebsiteBuilderButton,
  type WebsiteBuilderMediaAsset,
  type WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { HOME_HERO_SLIDES } from "../../data/home";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";
import { CatalogImage } from "../shared/CatalogImage";

type HeroSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  homeHref: string;
};

type ResolvedHeroSlide = {
  id: string;
  eyebrow: string | null;
  title: string | null;
  description: string | null;
  note: string | null;
  contentBackground: HomeHeroContentBackground;
  imageSrc: string | null;
  imageAlt: string;
  buttons: WebsiteBuilderButton[];
};

type SlideButtonsProps = {
  buttons: WebsiteBuilderButton[];
  homeHref: string;
  localizeHref: (href: string) => string;
  t: (text: string) => string;
  theme: ThemeTokens;
  tone: "image" | "content-light" | "content-dark";
};

type ButtonInput = Pick<WebsiteBuilderButton, "label" | "href" | "style"> &
  Partial<Pick<WebsiteBuilderButton, "id">>;

function compactText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeButtons(
  buttons: readonly ButtonInput[] | null | undefined,
) {
  return (buttons ?? [])
    .map((button, index) => {
      const label = compactText(button.label);
      const href = compactText(button.href);
      if (!label || !href) {
        return null;
      }
      return {
        ...button,
        id: compactText(button.id) ?? `hero-button-${index + 1}`,
        label,
        href,
      };
    })
    .filter((button): button is WebsiteBuilderButton => Boolean(button));
}

function resolveLegacyItemButtons(
  linkLabel: string | null | undefined,
  href: string | null | undefined,
  id: string,
) {
  const label = compactText(linkLabel);
  const resolvedHref = compactText(href);
  if (!label || !resolvedHref) {
    return [];
  }
  return [
    {
      id: `${id}-legacy-cta`,
      label,
      href: resolvedHref,
      style: "secondary" as const,
    },
  ];
}

function resolveFallbackSlides() {
  return HOME_HERO_SLIDES.map((slide) => ({
    id: slide.id,
    eyebrow: compactText(slide.eyebrow),
    title: compactText(slide.title),
    description: compactText(slide.subtitle),
    note: compactText(slide.note),
    contentBackground: slide.contentBackground ?? "mist",
    imageSrc: slide.image,
    imageAlt: slide.title,
    buttons: normalizeButtons(slide.buttons),
  })) satisfies ResolvedHeroSlide[];
}

function resolveHeroSlides(
  section: WebsiteBuilderSection | null | undefined,
  mediaLibrary: WebsiteBuilderMediaAsset[],
) {
  if (!section) {
    return resolveFallbackSlides();
  }

  const primaryAsset = resolveBuilderMedia(section.mediaId, mediaLibrary);
  const primarySlide: ResolvedHeroSlide = {
    id: section.id,
    eyebrow: compactText(section.eyebrow),
    title: compactText(section.title),
    description: compactText(section.subtitle),
    note: compactText(section.description),
    contentBackground: resolveHomeHeroContentBackground(section.settings),
    imageSrc: primaryAsset?.src ?? null,
    imageAlt: primaryAsset?.alt || compactText(section.title) || "Hero slide",
    buttons: normalizeButtons(section.buttons),
  };

  const extraSlides = (section.items ?? []).map((item) => {
    const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
    const buttons = normalizeButtons(item.buttons);
    return {
      id: item.id,
      eyebrow: compactText(item.badge),
      title: compactText(item.title),
      description: compactText(item.description),
      note: compactText(item.tag),
      contentBackground: resolveHomeHeroSlideContentBackground({
        slideBackground: item.contentBackground,
        settings: section.settings,
      }),
      imageSrc: asset?.src ?? null,
      imageAlt: asset?.alt || compactText(item.title) || "Hero slide",
      buttons: buttons.length
        ? buttons
        : resolveLegacyItemButtons(item.linkLabel, item.href, item.id),
    } satisfies ResolvedHeroSlide;
  });

  return [primarySlide, ...extraSlides];
}

function hasRenderableSlide(
  slide: ResolvedHeroSlide,
  sliderMode: ReturnType<typeof resolveHomeHeroSliderMode>,
) {
  return Boolean(
    slide.eyebrow ||
      slide.title ||
      slide.description ||
      slide.note ||
      slide.buttons.length ||
      (sliderMode === "image" && slide.imageSrc),
  );
}

function getSlideMotionClasses(
  animation: WebsiteBuilderSection["animation"] | undefined,
  isActive: boolean,
) {
  if (animation === "none") {
    return isActive ? "opacity-100" : "pointer-events-none opacity-0";
  }
  if (animation === "slide") {
    return isActive
      ? "translate-x-0 opacity-100"
      : "pointer-events-none translate-x-6 opacity-0";
  }
  if (animation === "zoom") {
    return isActive
      ? "scale-100 opacity-100"
      : "pointer-events-none scale-[1.02] opacity-0";
  }
  return isActive
    ? "translate-y-0 opacity-100"
    : "pointer-events-none translate-y-3 opacity-0";
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d={direction === "left" ? "M14 7l-5 5 5 5" : "M10 7l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const CONTENT_BACKGROUND_STYLES: Record<
  HomeHeroContentBackground,
  {
    surfaceClass: string;
    ambientClass: string;
    orbClass: string;
    accentLineClass: string;
    tone: "light" | "dark";
  }
> = {
  mist: {
    surfaceClass:
      "border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#f7f8fb_58%,#eef2f7_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.07),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.12),transparent_36%)]",
    orbClass: "bg-[var(--site-accent)]/8",
    accentLineClass: "bg-slate-300/70",
    tone: "light",
  },
  linen: {
    surfaceClass:
      "border border-stone-200/80 bg-[linear-gradient(135deg,#fffdf8_0%,#faf6ee_56%,#f2ecdf_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(120,53,15,0.05),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_38%)]",
    orbClass: "bg-amber-200/45",
    accentLineClass: "bg-stone-300/70",
    tone: "light",
  },
  pearl: {
    surfaceClass:
      "border border-slate-200/80 bg-[linear-gradient(135deg,#fcfdff_0%,#f1f5f9_54%,#e8eef6_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.06),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.13),transparent_34%)]",
    orbClass: "bg-sky-200/55",
    accentLineClass: "bg-slate-300/70",
    tone: "light",
  },
  blush: {
    surfaceClass:
      "border border-rose-100/80 bg-[linear-gradient(135deg,#fffaf9_0%,#fdf2f1_56%,#f7e8e4_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.06),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_36%)]",
    orbClass: "bg-rose-200/50",
    accentLineClass: "bg-rose-200/80",
    tone: "light",
  },
  sage: {
    surfaceClass:
      "border border-emerald-100/80 bg-[linear-gradient(135deg,#f7fbf8_0%,#eef5f0_56%,#e2ebe4_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(6,78,59,0.05),transparent_52%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_36%)]",
    orbClass: "bg-emerald-200/55",
    accentLineClass: "bg-emerald-200/80",
    tone: "light",
  },
  clay: {
    surfaceClass:
      "border border-rose-100/80 bg-[linear-gradient(135deg,#fff9f7_0%,#f8efeb_56%,#efdfda_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(127,29,29,0.05),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(225,29,72,0.1),transparent_36%)]",
    orbClass: "bg-rose-200/55",
    accentLineClass: "bg-rose-200/80",
    tone: "light",
  },
  navy: {
    surfaceClass:
      "border border-slate-700/70 bg-[linear-gradient(135deg,#0f172a_0%,#172036_56%,#243250_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_48%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.22),transparent_34%)]",
    orbClass: "bg-sky-300/20",
    accentLineClass: "bg-white/18",
    tone: "dark",
  },
  obsidian: {
    surfaceClass:
      "border border-white/8 bg-[linear-gradient(135deg,#09090b_0%,#111215_54%,#1a1b21_100%)]",
    ambientClass:
      "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(148,163,184,0.18),transparent_34%)]",
    orbClass: "bg-zinc-200/10",
    accentLineClass: "bg-white/14",
    tone: "dark",
  },
};

function SlideButtons({
  buttons,
  homeHref,
  localizeHref,
  t,
  theme,
  tone,
}: SlideButtonsProps) {
  if (!buttons.length) {
    return null;
  }

  const solidButtons = buttons.filter((button) => button.style !== "ghost");
  const ghostButtons = buttons.filter((button) => button.style === "ghost");
  const isImageTone = tone === "image";
  const isDarkContentTone = tone === "content-dark";
  const ghostClass =
    isImageTone
      ? "text-white underline decoration-white/30 hover:text-white/80"
      : isDarkContentTone
        ? "text-white/88 underline decoration-white/30 hover:text-white"
      : "text-slate-700 underline decoration-slate-300 hover:text-slate-950";

  return (
    <div className="mt-6 max-w-[44rem] sm:mt-8">
      {solidButtons.length ? (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {solidButtons.map((button) => {
            const href = localizeHref(
              resolveCisecoNavigationHref({
                href: button.href,
                homeHref,
                fallbackPath: "/collections",
              }),
            );
            return (
              <Button
                key={button.id}
                asChild
                variant="ghost"
                className={clsx(
                  theme.buttonShape,
                  "min-h-10 max-w-full px-4 text-sm leading-5 shadow-none whitespace-normal sm:min-h-11 sm:px-5",
                  isImageTone
                    ? button.style === "secondary"
                      ? "border border-white/22 bg-white/12 text-white hover:bg-white/18"
                      : "bg-white text-slate-950 hover:bg-white/92"
                    : isDarkContentTone
                      ? button.style === "secondary"
                        ? "border border-white/24 bg-white/10 text-white hover:bg-white/16"
                        : "bg-white text-slate-950 hover:bg-white/92"
                      : button.style === "secondary"
                      ? "border border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100"
                      : "bg-slate-950 text-white hover:bg-slate-900",
                )}
              >
                <a href={href}>{t(button.label)}</a>
              </Button>
            );
          })}
        </div>
      ) : null}

      {ghostButtons.length ? (
        <div
          className={clsx(
            "flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 sm:gap-x-5",
            solidButtons.length ? "sm:pt-3.5" : "pt-0",
          )}
        >
          {ghostButtons.map((button) => {
            const href = localizeHref(
              resolveCisecoNavigationHref({
                href: button.href,
                homeHref,
                fallbackPath: "/collections",
              }),
            );
            return (
              <a
                key={button.id}
                href={href}
                className={clsx(
                  "inline-flex max-w-full items-center text-sm font-semibold leading-6 underline-offset-4 transition [overflow-wrap:anywhere]",
                  ghostClass,
                )}
              >
                {t(button.label)}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function HeroSection({
  theme,
  section,
  mediaLibrary = [],
  homeHref,
}: HeroSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const sliderMode = resolveHomeHeroSliderMode({
    settings: section?.settings,
    mediaId: section?.mediaId,
    items: section?.items ?? [],
  });
  const rawSlides = useMemo(
    () => resolveHeroSlides(section, mediaLibrary),
    [mediaLibrary, section],
  );
  const slides = useMemo(
    () => rawSlides.filter((slide) => hasRenderableSlide(slide, sliderMode)),
    [rawSlides, sliderMode],
  );
  const autoSlideIntervalMs = clampHomeHeroSliderInterval(
    section?.settings?.autoSlideIntervalMs,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoplayReady, setAutoplayReady] = useState(false);

  const safeActiveIndex = activeIndex >= slides.length ? 0 : activeIndex;
  const showControls = slides.length > 1;
  const activeSlide = slides[safeActiveIndex] ?? slides[0];
  const activeContentStyle =
    sliderMode === "content"
      ? CONTENT_BACKGROUND_STYLES[
          activeSlide?.contentBackground ?? resolveHomeHeroContentBackground(section?.settings)
        ]
      : null;
  const isDarkContentSlide = activeContentStyle?.tone === "dark";

  useEffect(() => {
    if (!showControls) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      const requestId = window.requestIdleCallback(
        () => setAutoplayReady(true),
        { timeout: 1500 },
      );
      return () => {
        window.cancelIdleCallback?.(requestId);
      };
    }

    const timeoutId = window.setTimeout(() => {
      setAutoplayReady(true);
    }, 900);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showControls]);

  useEffect(() => {
    if (!autoplayReady || slides.length <= 1 || isPaused) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => {
        const nextIndex = current >= slides.length ? 0 : current;
        return (nextIndex + 1) % slides.length;
      });
    }, autoSlideIntervalMs);
    return () => window.clearTimeout(timer);
  }, [autoSlideIntervalMs, autoplayReady, isPaused, safeActiveIndex, slides.length]);

  if (!slides.length) {
    return null;
  }

  const frameClass =
    sliderMode === "image"
      ? "bg-slate-950 shadow-[0_34px_90px_-55px_rgba(2,6,23,0.65)]"
      : "shadow-[0_28px_80px_-54px_rgba(15,23,42,0.22)]";
  const heightClass =
    sliderMode === "image"
      ? "min-h-[430px] sm:min-h-[520px] lg:min-h-[620px]"
      : "min-h-[360px] sm:min-h-[430px] lg:min-h-[500px]";
  const imagePaddingClass = showControls
    ? "px-5 pb-20 pt-14 sm:px-10 sm:pb-24 sm:pt-16 lg:px-14 lg:pb-28 lg:pt-20"
    : "px-5 pb-12 pt-14 sm:px-10 sm:pb-16 sm:pt-16 lg:px-14 lg:pb-20 lg:pt-20";
  const contentPaddingClass = showControls
    ? "px-5 pb-20 pt-10 sm:px-10 sm:pb-24 sm:pt-12 lg:px-14 lg:pb-24 lg:pt-14"
    : "px-5 pb-12 pt-10 sm:px-10 sm:pb-16 sm:pt-12 lg:px-14 lg:pb-20 lg:pt-14";
  const controlShellClass =
    sliderMode === "image"
      ? "border-white/15 bg-white/10 text-white backdrop-blur"
      : isDarkContentSlide
        ? "border-white/15 bg-white/10 text-white backdrop-blur"
        : "border-slate-200 bg-white/88 text-slate-700";

  return (
    <Section
      theme={theme}
      id="hero"
      className="pb-5 pt-6 sm:pb-7 sm:pt-8"
      builderSectionId={section?.id}
    >
      <div
        className={clsx(
          "relative overflow-hidden",
          theme.corner,
          frameClass,
        )}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={() => setIsPaused(false)}
      >
        <div className={clsx("relative w-full", heightClass)}>
          {slides.map((slide, index) => {
            const isActive = index === safeActiveIndex;
            const contentStyle = CONTENT_BACKGROUND_STYLES[slide.contentBackground];
            const isDarkSurface = contentStyle.tone === "dark";
            return (
              <article
                key={slide.id}
                aria-hidden={!isActive}
                className={clsx(
                  "h-full w-full overflow-hidden transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isActive ? "relative z-10" : "absolute inset-0 z-0",
                  getSlideMotionClasses(section?.animation, isActive),
                )}
              >
                {sliderMode === "image" ? (
                  <div className={clsx("relative flex items-end", heightClass)}>
                    {slide.imageSrc ? (
                      <CatalogImage
                        src={slide.imageSrc}
                        alt={t(slide.imageAlt)}
                        className="object-cover object-center"
                        fill
                        sizes="(min-width: 1280px) 1240px, 100vw"
                        priority={index === 0}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,#111827_0%,#0f172a_45%,#1e293b_100%)]" />
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12)_0%,rgba(2,6,23,0.4)_38%,rgba(2,6,23,0.88)_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.18),transparent_34%)]" />
                    <div className={clsx("relative z-10 w-full", imagePaddingClass)}>
                      <div className="max-w-[41rem] sm:max-w-[43rem]">
                        <div className="space-y-0">
                          {slide.eyebrow ? (
                            <p className="ciseco-home-eyebrow inline-flex rounded-full border border-white/16 bg-white/10 px-3 py-1 text-white/86">
                              {t(slide.eyebrow)}
                            </p>
                          ) : null}
                          {slide.title ? (
                            <h1 className="ciseco-home-title mt-4 max-w-[12.5ch] text-[2.3rem] text-white [overflow-wrap:anywhere] sm:text-[3.7rem] lg:text-[4.75rem]">
                              {t(slide.title)}
                            </h1>
                          ) : null}
                          {slide.description ? (
                            <p className="ciseco-home-subtitle mt-5 max-w-[36rem] text-[0.98rem] text-white/82 [overflow-wrap:anywhere] sm:max-w-[38rem] sm:text-[1.03rem]">
                              {t(slide.description)}
                            </p>
                          ) : null}
                          {slide.note ? (
                            <p className="mt-4 max-w-[35rem] text-sm leading-6 text-white/64 [overflow-wrap:anywhere]">
                              {t(slide.note)}
                            </p>
                          ) : null}
                        </div>
                        <SlideButtons
                          buttons={slide.buttons}
                          homeHref={homeHref}
                          localizeHref={localizeHref}
                          t={t}
                          theme={theme}
                          tone="image"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={clsx(
                      "relative flex items-center",
                      heightClass,
                      contentStyle.surfaceClass,
                    )}
                  >
                    <div
                      className={clsx(
                        "pointer-events-none absolute inset-0",
                        contentStyle.ambientClass,
                      )}
                    />
                    <div
                      className={clsx(
                        "pointer-events-none absolute left-8 top-8 h-24 w-24 rounded-full blur-2xl sm:h-32 sm:w-32",
                        contentStyle.orbClass,
                      )}
                    />
                    <div
                      className={clsx(
                        "pointer-events-none absolute bottom-10 right-10 h-px w-24",
                        contentStyle.accentLineClass,
                      )}
                    />
                    <div className={clsx("relative z-10 w-full", contentPaddingClass)}>
                      <div className="max-w-[50rem] lg:max-w-[53rem]">
                        {slide.eyebrow ? (
                          <div className="mb-4 flex items-center gap-3 sm:mb-5">
                            <span
                              className={clsx(
                                "h-px w-8 sm:w-12",
                                isDarkSurface ? "bg-white/34" : "bg-[var(--site-accent)]/60",
                              )}
                            />
                            <p
                              className={clsx(
                                "ciseco-home-eyebrow",
                                isDarkSurface ? "text-white/76" : "text-slate-600",
                              )}
                            >
                              {t(slide.eyebrow)}
                            </p>
                          </div>
                        ) : null}
                        {slide.title ? (
                          <h1
                            className={clsx(
                              "ciseco-home-title max-w-[17ch] text-[2.05rem] [overflow-wrap:anywhere] [text-wrap:pretty] sm:max-w-[18ch] sm:text-[3.3rem] lg:max-w-[19ch] lg:text-[4.4rem]",
                              isDarkSurface ? "text-white" : "text-slate-950",
                            )}
                            style={isDarkSurface ? { color: "#ffffff" } : undefined}
                          >
                            {t(slide.title)}
                          </h1>
                        ) : null}
                        {slide.description ? (
                          <p
                            className={clsx(
                              "ciseco-home-subtitle mt-5 max-w-[43rem] text-[0.98rem] [overflow-wrap:anywhere] sm:max-w-[45rem] sm:text-[1.04rem] lg:max-w-[48rem]",
                              isDarkSurface ? "text-white/82" : "text-slate-600",
                            )}
                          >
                            {t(slide.description)}
                          </p>
                        ) : null}
                        {slide.note ? (
                          <p
                            className={clsx(
                              "mt-4 max-w-[44rem] text-sm leading-6 [overflow-wrap:anywhere] lg:max-w-[46rem]",
                              isDarkSurface ? "text-white/64" : "text-slate-500",
                            )}
                          >
                            {t(slide.note)}
                          </p>
                        ) : null}
                        <SlideButtons
                          buttons={slide.buttons}
                          homeHref={homeHref}
                          localizeHref={localizeHref}
                          t={t}
                          theme={theme}
                          tone={isDarkSurface ? "content-dark" : "content-light"}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {showControls ? (
          <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-5 sm:px-10 sm:pb-8 lg:px-14">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`${t("Go to slide")} ${index + 1}`}
                    onClick={() => setActiveIndex(index)}
                    className={clsx(
                      "h-2.5 rounded-full transition-all",
                      index === safeActiveIndex
                        ? "w-8 bg-[var(--site-accent)] sm:w-10"
                        : sliderMode === "image"
                          ? "w-2.5 bg-white/40"
                          : isDarkContentSlide
                            ? "w-2.5 bg-white/28"
                            : "w-2.5 bg-slate-300",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={clsx(
                    "hidden text-[11px] font-semibold tracking-[0.22em] sm:inline-flex",
                    sliderMode === "image" || isDarkContentSlide
                      ? "text-white/72"
                      : "text-slate-500",
                  )}
                >
                  {String(safeActiveIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  aria-label={t("Previous slide")}
                  className={clsx(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full border transition sm:h-10 sm:w-10",
                    controlShellClass,
                  )}
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === 0 ? slides.length - 1 : current - 1,
                    )
                  }
                >
                  <ArrowIcon direction="left" />
                </button>
                <button
                  type="button"
                  aria-label={t("Next slide")}
                  className={clsx(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full border transition sm:h-10 sm:w-10",
                    controlShellClass,
                  )}
                  onClick={() =>
                    setActiveIndex((current) => (current + 1) % slides.length)
                  }
                >
                  <ArrowIcon direction="right" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
