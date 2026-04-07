import clsx from "clsx";
import type { CSSProperties } from "react";
import type { CatalogWebsiteCmsPage } from "@/server/website";
import type { ThemeTokens } from "../types";
import { Reveal } from "../components/shared/Reveal";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";
import { resolveCisecoNavigationHref } from "../utils";

type CmsPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  page: CatalogWebsiteCmsPage;
};

export function CmsPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  page,
}: CmsPageProps) {
  const { localizeHref, t } = useCisecoI18n();
  const contactHref = resolveCisecoNavigationHref({
    href: "/contact",
    homeHref,
  });

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main className="pb-14 sm:pb-16">
        <div className={clsx("mx-auto px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8", theme.containerClass)}>
          <Reveal>
            <section className="relative overflow-hidden rounded-[32px] border border-black/5 bg-white px-6 py-8 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              >
                <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-[var(--site-accent-soft)] blur-3xl" />
                <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-slate-100 blur-3xl" />
              </div>
              <div className="relative z-10 space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <a
                    href={localizeHref(homeHref)}
                    className="transition hover:text-slate-700"
                  >
                    {t("Home")}
                  </a>
                  <span>/</span>
                  <span>{t("Information")}</span>
                </div>
                <div className="max-w-3xl space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--site-accent)]">
                    {t("Content page")}
                  </p>
                  <h1 className="font-[family:var(--ciseco-font-display)] text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-[3.35rem] lg:leading-[1.02]">
                    {page.title}
                  </h1>
                  {page.excerpt ? (
                    <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                      {page.excerpt}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </Reveal>
        </div>

        <div className={clsx("mx-auto mt-8 grid gap-6 px-4 sm:px-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:px-8", theme.containerClass)}>
          <Reveal delay={120} className="lg:order-2 lg:sticky lg:top-24">
            <div className="space-y-4">
              {page.headings.length ? (
                <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_16px_50px_-44px_rgba(15,23,42,0.45)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t("Table of contents")}
                  </p>
                  <nav className="mt-4 space-y-2">
                    {page.headings.map((heading) => (
                      <a
                        key={heading.id}
                        href={`#${heading.id}`}
                        className={clsx(
                          "block rounded-2xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900",
                          heading.level === 3 ? "ml-3" : null,
                          heading.level === 4 ? "ml-6 text-[13px]" : null,
                        )}
                      >
                        {heading.text}
                      </a>
                    ))}
                  </nav>
                </aside>
              ) : null}

              <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-[0_16px_50px_-44px_rgba(15,23,42,0.45)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t("Need help?")}
                </p>
                <h2 className="mt-3 font-[family:var(--ciseco-font-display)] text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {t("Speak with")} {companyName}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {t(
                    "For order questions, delivery details, payments or support, contact the store directly.",
                  )}
                </p>
                <a
                  href={localizeHref(contactHref)}
                  className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {t("Contact us")}
                </a>
              </aside>
            </div>
          </Reveal>

          <Reveal className="min-w-0 lg:order-1">
            <article className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-[0_20px_70px_-50px_rgba(15,23,42,0.42)]">
              <div className="border-b border-black/5 px-6 py-4 sm:px-10">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t("Reading page")}
                </p>
              </div>
              <div className="px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
                <div
                  className={clsx(
                    "text-[15px] leading-8 text-slate-600 sm:text-base",
                    "[&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline [&_a]:decoration-slate-300 [&_a]:underline-offset-4",
                    "[&_blockquote]:my-8 [&_blockquote]:rounded-[28px] [&_blockquote]:border [&_blockquote]:border-black/5 [&_blockquote]:bg-slate-50 [&_blockquote]:px-5 [&_blockquote]:py-5 [&_blockquote]:text-slate-700",
                    "[&_blockquote_p]:m-0",
                    "[&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.92em] [&_code]:text-slate-800",
                    "[&_hr]:my-10 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-black/6",
                    "[&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:font-[family:var(--ciseco-font-display)] [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-slate-950 sm:[&_h2]:text-[2rem]",
                    "[&_h3]:mt-8 [&_h3]:scroll-mt-24 [&_h3]:font-[family:var(--ciseco-font-display)] [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-[-0.02em] [&_h3]:text-slate-900",
                    "[&_h4]:mt-7 [&_h4]:scroll-mt-24 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-slate-900",
                    "[&_ol]:my-6 [&_ol]:space-y-3 [&_ol]:pl-5",
                    "[&_p]:my-5 [&_p]:max-w-none",
                    "[&_strong]:font-semibold [&_strong]:text-slate-950",
                    "[&_ul]:my-6 [&_ul]:space-y-3 [&_ul]:pl-5",
                    "[&_li]:pl-1",
                  )}
                  dangerouslySetInnerHTML={{ __html: page.contentHtml }}
                />
              </div>
            </article>
          </Reveal>
        </div>
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}
