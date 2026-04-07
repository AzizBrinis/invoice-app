"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCisecoI18n } from "../../i18n";

type LanguageOptionId = "en" | "fr";
export type CurrencyOptionId = "TND" | "USD" | "EUR";

const LANGUAGE_OPTIONS: Array<{
  id: LanguageOptionId;
  label: string;
  description: string;
}> = [
  {
    id: "fr",
    label: "Français",
    description: "France",
  },
  {
    id: "en",
    label: "English",
    description: "United States",
  },
];

// Keep the currency configuration in place so the selector can be re-enabled later
// without changing the rest of the template's default TND behavior.
export const DEFAULT_NAVBAR_CURRENCY: CurrencyOptionId = "TND";

export const NAVBAR_CURRENCY_OPTIONS: Array<{
  id: CurrencyOptionId;
  label: string;
  symbol: string;
}> = [
  {
    id: "TND",
    label: "TND",
    symbol: "DT",
  },
  {
    id: "USD",
    label: "USD",
    symbol: "$",
  },
  {
    id: "EUR",
    label: "EUR",
    symbol: "\u20ac",
  },
];

const MENU_ID = "ciseco-locale-currency-menu";
const TITLE_ID = "ciseco-locale-currency-menu-title";

function useIsCompactLayout() {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isCompact;
}

export function LocaleCurrencyMenu() {
  const { locale, setLocale, t } = useCisecoI18n();
  const isCompact = useIsCompactLayout();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedCurrency = DEFAULT_NAVBAR_CURRENCY;
  const selectedLanguage = locale as LanguageOptionId;
  const selectedLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.id === selectedLanguage)?.label ??
    "Français";
  const selectedLanguageCode = selectedLanguage.toUpperCase();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || isCompact) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, isCompact]);

  useEffect(() => {
    if (!open || !isCompact) return;

    const docEl = document.documentElement;
    const body = document.body;
    const previousOverflow = docEl.style.overflow;
    const previousPaddingRight = docEl.style.paddingRight;
    const previousTouchAction = body.style.touchAction;
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;

    docEl.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      docEl.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.style.touchAction = "none";

    const triggerElement = triggerRef.current;
    const focusTimeout = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimeout);
      docEl.style.overflow = previousOverflow;
      docEl.style.paddingRight = previousPaddingRight;
      body.style.touchAction = previousTouchAction;
      triggerElement?.focus();
    };
  }, [open, isCompact]);

  const closeMenu = () => setOpen(false);

  const panel = (
    <div
      ref={panelRef}
      id={MENU_ID}
      role="dialog"
      aria-labelledby={TITLE_ID}
      aria-modal={isCompact ? "true" : undefined}
      data-currency={selectedCurrency}
      tabIndex={-1}
      className={clsx(
        "w-[min(19rem,calc(100vw-1.5rem))] rounded-[24px] border border-black/[0.07] bg-white/98 p-3.5 text-slate-900 shadow-[0_24px_64px_rgba(15,23,42,0.16),0_4px_16px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:w-[19.5rem] sm:p-4",
        "transition duration-200 ease-out focus:outline-none",
        isCompact
          ? open
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
          : open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-2 scale-[0.98] opacity-0",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3 px-1">
        <div>
          <p
            id={TITLE_ID}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
          >
            {t("Language")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {t(selectedLanguageLabel)}
          </p>
        </div>
        {isCompact ? (
          <button
            type="button"
            onClick={closeMenu}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-slate-500 transition hover:border-black/15 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
            aria-label={t("Close menu")}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = option.id === selectedLanguage;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              className={clsx(
                "flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200",
                isSelected
                  ? "border-[color:var(--site-accent-strong)] bg-[color:var(--site-accent-soft)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.02)]"
                  : "border-transparent bg-white hover:border-black/5 hover:bg-slate-50",
              )}
              onClick={() => {
                setLocale(option.id);
                closeMenu();
              }}
            >
              <span
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold uppercase tracking-[0.16em]",
                  isSelected
                    ? "border-[color:var(--site-accent-strong)] bg-white/80 text-slate-900"
                    : "border-black/10 bg-slate-50 text-slate-500",
                )}
              >
                {option.id.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-5 text-slate-900">
                  {t(option.label)}
                </span>
                <span className="mt-0.5 block text-[13px] leading-4 text-slate-500">
                  {t(option.description)}
                </span>
              </span>
              <span
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
                  isSelected
                    ? "border-[color:var(--site-accent-strong)] bg-slate-900 text-white"
                    : "border-black/10 bg-white text-transparent",
                )}
                aria-hidden="true"
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-haspopup="dialog"
        aria-label={t("Language")}
        className={clsx(
          "flex h-10 items-center justify-center rounded-full border border-black/10 bg-white text-slate-700 transition hover:border-black/20 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200",
          "w-10 px-0 sm:w-auto sm:gap-2 sm:px-3.5",
          open ? "border-black/15 shadow-[0_10px_24px_rgba(15,23,42,0.08)]" : "",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <GlobeIcon className="h-4 w-4 shrink-0" />
        <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:inline lg:hidden">
          {selectedLanguageCode}
        </span>
        <span className="hidden text-sm font-semibold lg:inline">
          {t(selectedLanguageLabel)}
        </span>
        <ChevronDownIcon
          className={clsx(
            "hidden h-3.5 w-3.5 shrink-0 transition sm:block",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {!isCompact ? (
        <div
          className={clsx(
            "absolute right-0 top-full z-[95] mt-4 origin-top-right",
            open ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          {panel}
        </div>
      ) : null}

      {typeof document !== "undefined" && isCompact
        ? createPortal(
            <>
              <div
                className={clsx(
                  "fixed inset-0 z-[90] bg-slate-900/22 backdrop-blur-[2px] transition-opacity duration-200",
                  open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
                aria-hidden="true"
                onClick={closeMenu}
              />
              <div
                className={clsx(
                  "fixed inset-x-0 top-[78px] z-[100] flex justify-center px-3 transition-opacity duration-200 sm:top-[88px] sm:px-6",
                  open ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                {panel}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M4.5 12h15M12 4c2 2.3 3 5 3 8s-1 5.7-3 8m0-16c-2 2.3-3 5-3 8s1 5.7 3 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M5 7.5l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M5 10.5l3.1 3.1L15 6.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M6 6l8 8M14 6l-8 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
