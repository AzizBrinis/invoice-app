import clsx from "clsx";
import { Children, type CSSProperties, type ReactNode } from "react";
import type { ThemeTokens } from "../../types";
import { Footer } from "../layout/Footer";
import { Navbar } from "../layout/Navbar";
import { PageShell } from "../layout/PageShell";
import { Reveal } from "../shared/Reveal";

type AuthLayoutChrome = {
  companyName: string;
  homeHref: string;
};

type AuthLayoutProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  title: string;
  subtitle?: string;
  children: ReactNode;
  builderSectionId?: string;
  belowContent?: ReactNode;
  contentClassName?: string;
  chrome?: AuthLayoutChrome;
};

export function AuthLayout({
  theme,
  inlineStyles,
  title,
  subtitle,
  children,
  builderSectionId,
  belowContent,
  contentClassName,
  chrome,
}: AuthLayoutProps) {
  const items = Children.toArray(children);
  return (
    <PageShell inlineStyles={inlineStyles}>
      {chrome ? (
        <Navbar
          theme={theme}
          companyName={chrome.companyName}
          homeHref={chrome.homeHref}
        />
      ) : null}
      <main
        data-ciseco-auth-main
        className={clsx("bg-white", chrome ? undefined : "min-h-screen")}
      >
        <div
          className={clsx(
            "mx-auto px-6 pb-20 pt-16 sm:px-8 sm:pt-20 lg:pt-24",
            theme.containerClass,
          )}
        >
          <div className="mx-auto flex w-full max-w-[420px] flex-col">
            <Reveal delay={40}>
              <header
                className="text-center"
                data-builder-section={builderSectionId}
              >
                <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
                ) : null}
              </header>
            </Reveal>
            <div className={clsx("mt-8 flex flex-col gap-6", contentClassName)}>
              {items.map((child, index) => (
                <Reveal key={index} delay={140 + index * 90}>
                  {child}
                </Reveal>
              ))}
            </div>
          </div>
        </div>
        {belowContent}
      </main>
      {chrome ? <Footer theme={theme} companyName={chrome.companyName} /> : null}
    </PageShell>
  );
}
