"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  appendCisecoLocaleToHref,
  CISECO_LOCALE_COOKIE_NAME,
  CISECO_LOCALE_QUERY_PARAM,
  CISECO_LOCALE_STORAGE_KEY,
  DEFAULT_CISECO_LOCALE,
  parseCisecoLocale,
  type CisecoLocale,
  translateCisecoText,
} from "./locale";
import { useCisecoLocation, useCisecoNavigation } from "./navigation";

type CisecoI18nContextValue = {
  locale: CisecoLocale;
  setLocale: (locale: CisecoLocale) => void;
  t: (text: string) => string;
  localizeHref: (href: string) => string;
};

const CisecoI18nContext = createContext<CisecoI18nContextValue | null>(null);

type CisecoLocaleProviderProps = {
  initialLocale?: CisecoLocale;
  children: ReactNode;
};

export function CisecoLocaleProvider({
  initialLocale,
  children,
}: CisecoLocaleProviderProps) {
  const { pathname, searchParams } = useCisecoLocation();
  const { replace } = useCisecoNavigation();
  const [selectedLocale, setSelectedLocale] = useState<CisecoLocale>(
    initialLocale ?? DEFAULT_CISECO_LOCALE,
  );
  const locale =
    parseCisecoLocale(searchParams.get(CISECO_LOCALE_QUERY_PARAM)) ??
    selectedLocale;

  useEffect(() => {
    const queryLocale = parseCisecoLocale(
      searchParams.get(CISECO_LOCALE_QUERY_PARAM),
    );
    if (queryLocale) {
      return;
    }

    const persistedLocale = parseCisecoLocale(
      window.localStorage.getItem(CISECO_LOCALE_STORAGE_KEY),
    );
    if (!persistedLocale || persistedLocale === locale) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set(CISECO_LOCALE_QUERY_PARAM, persistedLocale);
    const nextUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    replace(nextUrl, { scroll: false });
  }, [locale, pathname, replace, searchParams]);

  useEffect(() => {
    document.documentElement.lang = locale === "fr" ? "fr" : "en";
    window.localStorage.setItem(CISECO_LOCALE_STORAGE_KEY, locale);
    document.cookie = `${CISECO_LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const setLocale = useCallback(
    (nextLocale: CisecoLocale) => {
      setSelectedLocale(nextLocale);

      const params = new URLSearchParams(searchParams.toString());
      params.set(CISECO_LOCALE_QUERY_PARAM, nextLocale);
      const nextUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      replace(nextUrl, { scroll: false });
    },
    [pathname, replace, searchParams],
  );

  const t = useCallback(
    (text: string) => translateCisecoText(locale, text),
    [locale],
  );

  const localizeHref = useCallback(
    (href: string) => appendCisecoLocaleToHref(href, locale),
    [locale],
  );

  const value = useMemo<CisecoI18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      localizeHref,
    }),
    [locale, localizeHref, setLocale, t],
  );

  return (
    <CisecoI18nContext.Provider value={value}>
      {children}
    </CisecoI18nContext.Provider>
  );
}

export function useCisecoI18n() {
  const context = useContext(CisecoI18nContext);
  if (!context) {
    throw new Error("useCisecoI18n must be used within CisecoLocaleProvider.");
  }
  return context;
}
