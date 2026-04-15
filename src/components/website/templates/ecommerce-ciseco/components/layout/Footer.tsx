import clsx from "clsx";
import type { CSSProperties } from "react";
import { FOOTER_LINKS } from "../../data/navigation";
import {
  DEFAULT_FOOTER_BOTTOM_TEXT,
  DEFAULT_FOOTER_CMS_TITLE,
  DEFAULT_FOOTER_DESCRIPTION,
  DEFAULT_FOOTER_SHORTCUTS,
} from "../../data/footer";
import type { ThemeTokens } from "../../types";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { useCisecoCmsPages } from "../../cms-context";
import { useCisecoFooter } from "../../footer-context";

type FooterProps = {
  theme: ThemeTokens;
  companyName: string;
  homeHref?: string;
  spacing?: "default" | "compact";
};

function renderFooterShortcutIcon(icon: string) {
  switch (icon) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M4.75 10.75L12 4.75l7.25 6v8.5H14.5v-5h-5v5H4.75z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case "collections":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <rect
            x="4.75"
            y="5"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <rect
            x="12.75"
            y="5"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <rect
            x="4.75"
            y="12.5"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <rect
            x="12.75"
            y="12.5"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <circle
            cx="10.5"
            cy="10.5"
            r="5.75"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M15 15l4.25 4.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "contact":
      return (
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
      );
    case "about":
      return (
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
      );
    case "cart":
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <circle cx="9" cy="18" r="1.5" fill="currentColor" />
          <circle cx="17" cy="18" r="1.5" fill="currentColor" />
          <path
            d="M4.5 6h2l1.5 7.5h8.75l1.75-5.5H7.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case "account":
      return (
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
            d="M5.5 18c1.6-2.6 3.8-4 6.5-4s4.9 1.4 6.5 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "blog":
    default:
      return (
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
      );
  }
}

function resolveFooterTextTemplate(
  value: string,
  companyName: string,
) {
  return value
    .replaceAll("{{companyName}}", companyName)
    .replaceAll("{{year}}", new Date().getFullYear().toString());
}

export function Footer({
  theme,
  companyName,
  homeHref = "#",
  spacing = "default",
}: FooterProps) {
  const { localizeHref } = useCisecoI18n();
  const cmsPages = useCisecoCmsPages();
  const footer = useCisecoFooter();
  const footerCmsPages = cmsPages.filter((page) => page.showInFooter);
  const shortcuts =
    footer?.shortcuts ??
    DEFAULT_FOOTER_SHORTCUTS.map((item, index) => ({
      id: `default-shortcut-${index + 1}`,
      ...item,
    }));
  const linkGroups =
    footer?.linkGroups ??
    FOOTER_LINKS.map((group, index) => ({
      id: `default-group-${index + 1}`,
      title: group.title,
      links: group.links,
    }));
  const description = footer?.description ?? DEFAULT_FOOTER_DESCRIPTION;
  const infoTitle = footer?.infoTitle?.trim() ?? "";
  const infoBody = footer?.infoBody?.trim() ?? "";
  const cmsTitle = footer?.cmsTitle ?? DEFAULT_FOOTER_CMS_TITLE;
  const bottomText = resolveFooterTextTemplate(
    footer?.bottomText ?? DEFAULT_FOOTER_BOTTOM_TEXT,
    companyName,
  ).trim();
  const hasInfoSection = Boolean(infoTitle || infoBody);
  const footerColumnCount = Math.max(
    1,
    linkGroups.length + (footerCmsPages.length ? 1 : 0) + (hasInfoSection ? 1 : 0),
  );
  const footerGridStyle = {
    "--footer-columns": footerColumnCount.toString(),
  } as CSSProperties;

  return (
    <footer
      className={clsx(
        "border-t border-black/5 bg-white",
        spacing === "compact" ? null : "mt-8",
      )}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "1px 720px",
      }}
    >
      <div
        className={clsx(
          "mx-auto grid grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:gap-8 lg:px-8",
          "lg:grid-cols-[minmax(0,1.2fr)_repeat(var(--footer-columns),minmax(0,1fr))]",
          theme.containerClass,
        )}
        style={footerGridStyle}
      >
        <div className="col-span-2 space-y-4 sm:col-span-3 lg:col-span-1">
          <a
            href={localizeHref(homeHref)}
            className="inline-flex min-w-0 max-w-full items-baseline text-[24px] font-bold leading-none tracking-tight text-slate-900 sm:text-[30px]"
          >
            <span>{companyName}</span>
            <span className="shrink-0 text-[var(--site-accent)]">.</span>
          </a>
          {description ? (
            <p className="max-w-[20rem] text-sm text-slate-600">
              {description}
            </p>
          ) : null}
          {shortcuts.length ? (
            <div className="flex flex-wrap items-center gap-3">
              {shortcuts.map((item) => (
                <a
                  key={item.id}
                  href={localizeHref(
                    resolveCisecoNavigationHref({
                      href: item.href,
                      homeHref,
                    }),
                  )}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 hover:text-slate-900"
                  aria-label={item.label}
                  title={item.label}
                >
                  {renderFooterShortcutIcon(item.icon)}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        {linkGroups.map((group) => (
          <div key={group.id ?? group.title} className="min-w-0 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{group.title}</p>
            <div className="grid gap-2 text-slate-600">
              {group.links.map((link) => (
                <a
                  key={`${group.id ?? group.title}-${link.label}-${link.href}`}
                  href={localizeHref(
                    resolveCisecoNavigationHref({
                      href: link.href,
                      homeHref,
                    }),
                  )}
                  className="break-words hover:text-slate-900"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        ))}
        {hasInfoSection ? (
          <div className="min-w-0 space-y-3 text-sm">
            {infoTitle ? (
              <p className="font-semibold text-slate-900">{infoTitle}</p>
            ) : null}
            {infoBody ? (
              <p className="whitespace-pre-line leading-6 text-slate-600">
                {infoBody}
              </p>
            ) : null}
          </div>
        ) : null}
        {footerCmsPages.length ? (
          <div className="min-w-0 space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{cmsTitle}</p>
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
      {bottomText ? (
        <div className="border-t border-black/5 px-4 py-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          {bottomText}
        </div>
      ) : null}
    </footer>
  );
}
