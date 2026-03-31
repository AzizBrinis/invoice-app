import clsx from "clsx";
import { FOOTER_LINKS } from "../../data/navigation";
import type { ThemeTokens } from "../../types";

type FooterProps = {
  theme: ThemeTokens;
  companyName: string;
};

export function Footer({ theme, companyName }: FooterProps) {
  return (
    <footer className="mt-8 border-t border-black/5 bg-white">
      <div
        className={clsx(
          "mx-auto grid gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_repeat(4,1fr)] lg:px-8",
          theme.containerClass,
        )}
      >
        <div className="space-y-4">
          <div className="text-[30px] font-bold leading-none tracking-tight text-slate-900">
            {companyName}
            <span className="text-[var(--site-accent)]">.</span>
          </div>
          <p className="max-w-[260px] text-sm text-slate-600">
            A clean and adaptable starting point for catalog, service, or
            content-driven websites.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 hover:text-slate-900"
              aria-label="Social link"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M8 11v7H5v-7H3v-3h2V6.5A3.5 3.5 0 0 1 8.5 3H12v3H9.5A1.5 1.5 0 0 0 8 7.5V8h4v3H8z"
                  fill="currentColor"
                />
              </svg>
            </a>
            <a
              href="#"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 hover:text-slate-900"
              aria-label="Social link"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
                <circle cx="17" cy="7" r="1" fill="currentColor" />
              </svg>
            </a>
            <a
              href="#"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 hover:text-slate-900"
              aria-label="Social link"
            >
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
            </a>
          </div>
        </div>
        {FOOTER_LINKS.map((group) => (
          <div key={group.title} className="space-y-3 text-sm">
            <p className="font-semibold text-slate-900">{group.title}</p>
            <div className="grid gap-2 text-slate-600">
              {group.links.map((link) => (
                <a key={link} href="#" className="hover:text-slate-900">
                  {link}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-black/5 py-4 text-center text-xs text-slate-500">
        {companyName}. All rights reserved.
      </div>
    </footer>
  );
}
