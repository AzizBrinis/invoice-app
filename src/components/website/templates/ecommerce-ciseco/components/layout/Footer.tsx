import clsx from "clsx";
import { FOOTER_LINKS } from "../../data/navigation";
import type { ThemeTokens } from "../../types";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { useCisecoCmsPages } from "../../cms-context";

type FooterProps = {
  theme: ThemeTokens;
  companyName: string;
  homeHref?: string;
  spacing?: "default" | "compact";
};

const QUICK_LINKS = [
  {
    href: "/about",
    label: "About us",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <circle
          cx="12"
          cy="8"
          r="3.2"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M6.5 18c1.2-2.6 3.2-4 5.5-4s4.3 1.4 5.5 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    href: "/blog",
    label: "Blog",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d="M6 6.5h12M6 11h12M6 15.5h7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="2.25"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    ),
  },
  {
    href: "/contact",
    label: "Contact",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d="M4 7.5C4 6.1 5.1 5 6.5 5h11c1.4 0 2.5 1.1 2.5 2.5v9c0 1.4-1.1 2.5-2.5 2.5h-11C5.1 19 4 17.9 4 16.5v-9z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
        <path
          d="M5 7l7 5 7-5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    ),
  },
];

export function Footer({
  theme,
  companyName,
  homeHref = "#",
  spacing = "default",
}: FooterProps) {
  const { t, localizeHref } = useCisecoI18n();
  const cmsPages = useCisecoCmsPages();
  const footerCmsPages = cmsPages.filter((page) => page.showInFooter);

  return (
    <footer
      className={clsx(
        "border-t border-black/5 bg-white",
        spacing === "compact" ? null : "mt-8",
      )}
    >
      <div
        className={clsx(
          "mx-auto grid grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:gap-8 lg:px-8",
          footerCmsPages.length
            ? "lg:grid-cols-[1.2fr_repeat(5,1fr)]"
            : "lg:grid-cols-[1.2fr_repeat(4,1fr)]",
          theme.containerClass,
        )}
      >
        <div className="col-span-2 space-y-4 sm:col-span-3 lg:col-span-1">
          <a
            href={localizeHref(homeHref)}
            className="inline-flex min-w-0 max-w-full items-baseline text-[24px] font-bold leading-none tracking-tight text-slate-900 sm:text-[30px]"
          >
            <span>{companyName}</span>
            <span className="shrink-0 text-[var(--site-accent)]">.</span>
          </a>
          <p className="max-w-[20rem] text-sm text-slate-600">
            {t(
              "A clean and adaptable starting point for catalog, service, or content-driven websites.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {QUICK_LINKS.map((item) => (
              <a
                key={item.label}
                href={localizeHref(
                  resolveCisecoNavigationHref({
                    href: item.href,
                    homeHref,
                  }),
                )}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 hover:text-slate-900"
                aria-label={t(item.label)}
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>
        {FOOTER_LINKS.map((group) => (
          <div key={group.title} className="min-w-0 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{t(group.title)}</p>
            <div className="grid gap-2 text-slate-600">
              {group.links.map((link) => (
                <a
                  key={`${group.title}-${link.label}`}
                  href={localizeHref(
                    resolveCisecoNavigationHref({
                      href: link.href,
                      homeHref,
                    }),
                  )}
                  className="break-words hover:text-slate-900"
                >
                  {t(link.label)}
                </a>
              ))}
            </div>
          </div>
        ))}
        {footerCmsPages.length ? (
          <div className="min-w-0 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{t("Information")}</p>
            <div className="grid gap-2 text-slate-600">
              {footerCmsPages.map((page) => (
                <a
                  key={page.id}
                  href={localizeHref(
                    resolveCisecoNavigationHref({
                      href: page.path,
                      homeHref,
                    }),
                  )}
                  className="break-words hover:text-slate-900"
                >
                  {page.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="border-t border-black/5 px-4 py-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
        {companyName}. {t("All rights reserved.")}
      </div>
    </footer>
  );
}
