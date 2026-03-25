import clsx from "clsx";
import type { ThemeTokens } from "../../types";

const PROMO_ILLUSTRATION =
  "https://raw.githubusercontent.com/undraw/undraw/master/illustrations/undraw_savings_re_eq4w.svg";

type PromoBlockProps = {
  theme: ThemeTokens;
  companyName: string;
};

export function PromoBlock({ theme, companyName }: PromoBlockProps) {
  return (
    <section className="py-14 sm:py-16 lg:py-20">
      <div
        className={clsx(
          "mx-auto grid items-center gap-10 px-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
          theme.containerClass,
        )}
      >
        <div className="space-y-5">
          <div className="text-lg font-semibold text-slate-900">
            {companyName}
            <span className="text-[var(--site-accent)]">.</span>
          </div>
          <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Earn free money with {companyName}.
          </h2>
          <p className="text-sm text-slate-500">
            With {companyName} you will get free shipping & savings combo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#"
              className={clsx(
                theme.buttonShape,
                "bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800",
              )}
            >
              Savings combo
            </a>
            <a
              href="#"
              className={clsx(
                theme.buttonShape,
                "border border-black/10 bg-white px-5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50",
              )}
            >
              Discover more
            </a>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md">
            <img
              src={PROMO_ILLUSTRATION}
              alt="Ciseco rewards illustration"
              className="w-full"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
