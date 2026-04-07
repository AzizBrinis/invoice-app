"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { flushSync } from "react-dom";
import { normalizePath } from "./utils";

const FALLBACK_ORIGIN = "https://catalog.local";
const LOCAL_NAVIGATION_SETTLE_MS = 180;

type CisecoNavigationMode = "public" | "preview";

type CisecoNavigationState = {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  logicalPath: string;
  searchParams: URLSearchParams;
  isOwned: boolean;
};

type CisecoNavigationOptions = {
  replace?: boolean;
  scroll?: boolean;
};

type CisecoNavigationContextValue = {
  pathname: string;
  search: string;
  hash: string;
  href: string;
  logicalPath: string;
  searchParams: URLSearchParams;
  isNavigating: boolean;
  navigate: (href: string, options?: CisecoNavigationOptions) => boolean;
  replace: (href: string, options?: Omit<CisecoNavigationOptions, "replace">) => boolean;
  prefetch: (href: string) => void;
};

type CisecoNavigationProviderProps = {
  mode: CisecoNavigationMode;
  slug: string;
  initialHref: string;
  initialPath?: string | null;
  serverRoutedPaths?: string[];
  onPrefetchRoute?: (logicalPath: string) => void;
  children: ReactNode;
};

type ResolveCisecoStateOptions = {
  href: string;
  mode: CisecoNavigationMode;
  slug: string;
  fallbackLogicalPath?: string | null;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => {
    finished: Promise<void>;
  };
};

const CisecoNavigationContext =
  createContext<CisecoNavigationContextValue | null>(null);

function normalizeOwnedPathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isOwnedCisecoPathname(
  pathname: string,
  mode: CisecoNavigationMode,
  slug: string,
) {
  const normalizedPathname = normalizeOwnedPathname(pathname);

  if (mode === "preview") {
    return normalizedPathname === "/preview";
  }

  const ownedPath = `/catalogue/${slug}`;
  return (
    normalizedPathname === ownedPath ||
    normalizedPathname.startsWith(`${ownedPath}/`)
  );
}

export function resolveCisecoLogicalPath(
  url: URL,
  mode: CisecoNavigationMode,
  slug: string,
  fallbackLogicalPath = "/",
) {
  if (mode === "preview") {
    return normalizePath(url.searchParams.get("path") ?? fallbackLogicalPath);
  }

  const prefix = `/catalogue/${slug}`;
  const normalizedPathname = normalizeOwnedPathname(url.pathname);

  if (
    normalizedPathname === prefix ||
    normalizedPathname === `${prefix}/`
  ) {
    return "/";
  }

  if (normalizedPathname.startsWith(`${prefix}/`)) {
    return normalizePath(normalizedPathname.slice(prefix.length));
  }

  return normalizePath(fallbackLogicalPath);
}

export function resolveCisecoNavigationState({
  href,
  mode,
  slug,
  fallbackLogicalPath,
}: ResolveCisecoStateOptions): CisecoNavigationState {
  const url = new URL(href, FALLBACK_ORIGIN);
  const logicalPath = resolveCisecoLogicalPath(
    url,
    mode,
    slug,
    fallbackLogicalPath ?? "/",
  );

  return {
    href: `${url.pathname}${url.search}${url.hash}`,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    logicalPath,
    searchParams: new URLSearchParams(url.search),
    isOwned: isOwnedCisecoPathname(url.pathname, mode, slug),
  };
}

export function shouldUseServerNavigationForOwnedPath(
  logicalPath: string,
  serverRoutedPaths?: readonly string[],
) {
  if (!serverRoutedPaths?.length) {
    return false;
  }

  const normalizedPath = normalizePath(logicalPath);
  return serverRoutedPaths.some((path) => normalizePath(path) === normalizedPath);
}

function getCurrentBrowserUrl(fallbackHref: string) {
  if (typeof window === "undefined") {
    return new URL(fallbackHref, FALLBACK_ORIGIN);
  }

  return new URL(window.location.href);
}

function findClosestAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest("a[href]") as HTMLAnchorElement | null;
}

function shouldIgnoreAnchor(anchor: HTMLAnchorElement) {
  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref === "#") {
    return true;
  }

  if (
    anchor.target &&
    anchor.target !== "_self" &&
    anchor.target !== ""
  ) {
    return true;
  }

  if (
    anchor.hasAttribute("download") ||
    anchor.dataset.noSpa === "true" ||
    anchor.getAttribute("rel")?.includes("external")
  ) {
    return true;
  }

  if (anchor.getAttribute("aria-disabled") === "true") {
    return true;
  }

  return false;
}

function scrollToHash(hash: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (!hash) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return;
  }

  const element = document.getElementById(hash.slice(1));
  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    return;
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export function CisecoNavigationProvider({
  mode,
  slug,
  initialHref,
  initialPath,
  serverRoutedPaths,
  onPrefetchRoute,
  children,
}: CisecoNavigationProviderProps) {
  const router = useRouter();
  const fallbackLogicalPath = normalizePath(initialPath);
  const settleTimeoutRef = useRef<number | null>(null);
  const prefetchedHrefsRef = useRef<Set<string>>(new Set());
  const [isNavigating, setIsNavigating] = useState(false);
  const [state, setState] = useState(() =>
    resolveCisecoNavigationState({
      href: initialHref,
      mode,
      slug,
      fallbackLogicalPath,
    }),
  );

  const clearNavigationState = useCallback(() => {
    if (settleTimeoutRef.current != null) {
      window.clearTimeout(settleTimeoutRef.current);
    }
    settleTimeoutRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      settleTimeoutRef.current = null;
    }, LOCAL_NAVIGATION_SETTLE_MS);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextState = resolveCisecoNavigationState({
        href: window.location.href,
        mode,
        slug,
        fallbackLogicalPath,
      });

      const applyState = () => {
        flushSync(() => {
          setState(nextState);
        });
      };

      const documentWithTransitions = document as ViewTransitionDocument;
      if (documentWithTransitions.startViewTransition) {
        documentWithTransitions.startViewTransition(applyState);
      } else {
        applyState();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [fallbackLogicalPath, mode, slug]);

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current != null) {
        window.clearTimeout(settleTimeoutRef.current);
      }
    };
  }, []);

  const normalizedServerRoutedPaths = useMemo(
    () => (serverRoutedPaths ?? []).map((path) => normalizePath(path)),
    [serverRoutedPaths],
  );

  const prefetch = useCallback(
    (href: string) => {
      const candidate = href.trim();
      if (!candidate || candidate === "#") {
        return;
      }

      const currentUrl = getCurrentBrowserUrl(state.href);
      const nextUrl = new URL(candidate, currentUrl);

      if (nextUrl.origin !== currentUrl.origin) {
        return;
      }

      const nextState = resolveCisecoNavigationState({
        href: nextUrl.toString(),
        mode,
        slug,
        fallbackLogicalPath: state.logicalPath,
      });
      const prefetchKey = nextState.href;
      if (prefetchedHrefsRef.current.has(prefetchKey)) {
        return;
      }
      prefetchedHrefsRef.current.add(prefetchKey);

      if (nextState.isOwned) {
        if (
          shouldUseServerNavigationForOwnedPath(
            nextState.logicalPath,
            normalizedServerRoutedPaths,
          )
        ) {
          try {
            router.prefetch(`${nextUrl.pathname}${nextUrl.search}` as Route);
          } catch {
            // Ignore invalid typed-route inference for runtime-generated links.
          }
          return;
        }
        onPrefetchRoute?.(nextState.logicalPath);
        return;
      }

      try {
        router.prefetch(`${nextUrl.pathname}${nextUrl.search}` as Route);
      } catch {
        // Ignore invalid typed-route inference for runtime-generated links.
      }
    },
    [
      mode,
      normalizedServerRoutedPaths,
      onPrefetchRoute,
      router,
      slug,
      state.href,
      state.logicalPath,
    ],
  );

  const navigate = useCallback(
    (href: string, options: CisecoNavigationOptions = {}) => {
      const candidate = href.trim();
      if (!candidate || candidate === "#") {
        return false;
      }

      const currentUrl = getCurrentBrowserUrl(state.href);
      const nextUrl = new URL(candidate, currentUrl);

      if (nextUrl.origin !== currentUrl.origin) {
        if (typeof window !== "undefined") {
          window.location.assign(nextUrl.toString());
          return true;
        }
        return false;
      }

      const nextState = resolveCisecoNavigationState({
        href: nextUrl.toString(),
        mode,
        slug,
        fallbackLogicalPath: state.logicalPath,
      });

      if (nextState.isOwned) {
        onPrefetchRoute?.(nextState.logicalPath);

        const currentHref = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
        if (currentHref === nextState.href) {
          return true;
        }

        const isHashOnlyNavigation =
          currentUrl.pathname === nextUrl.pathname &&
          currentUrl.search === nextUrl.search &&
          currentUrl.hash !== nextUrl.hash;

        const applyState = () => {
          if (options.replace) {
            window.history.replaceState(window.history.state, "", nextState.href);
          } else {
            window.history.pushState(window.history.state, "", nextState.href);
          }

          flushSync(() => {
            setState(nextState);
          });
        };

        if (isHashOnlyNavigation) {
          applyState();
          window.requestAnimationFrame(() => {
            scrollToHash(nextState.hash);
          });
          return true;
        }

        if (
          shouldUseServerNavigationForOwnedPath(
            nextState.logicalPath,
            normalizedServerRoutedPaths,
          )
        ) {
          setIsNavigating(true);
          const relativeHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
          try {
            if (options.replace) {
              router.replace(relativeHref as Route, {
                scroll: options.scroll,
              });
            } else {
              router.push(relativeHref as Route, {
                scroll: options.scroll,
              });
            }
          } catch {
            window.location.assign(nextUrl.toString());
          }
          clearNavigationState();
          return true;
        }

        setIsNavigating(true);
        const documentWithTransitions = document as ViewTransitionDocument;
        if (documentWithTransitions.startViewTransition) {
          documentWithTransitions.startViewTransition(applyState);
        } else {
          applyState();
        }

        window.requestAnimationFrame(() => {
          if (options.scroll !== false) {
            scrollToHash(nextState.hash);
          }
          clearNavigationState();
        });

        return true;
      }

      setIsNavigating(true);
      const relativeHref = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      try {
        if (options.replace) {
          router.replace(relativeHref as Route, {
            scroll: options.scroll,
          });
        } else {
          router.push(relativeHref as Route, {
            scroll: options.scroll,
          });
        }
      } catch {
        window.location.assign(nextUrl.toString());
      }
      clearNavigationState();
      return true;
    },
    [
      clearNavigationState,
      mode,
      normalizedServerRoutedPaths,
      onPrefetchRoute,
      router,
      slug,
      state.href,
      state.logicalPath,
    ],
  );

  const replace = useCallback(
    (href: string, options: Omit<CisecoNavigationOptions, "replace"> = {}) =>
      navigate(href, { ...options, replace: true }),
    [navigate],
  );

  const value = useMemo<CisecoNavigationContextValue>(
    () => ({
      pathname: state.pathname,
      search: state.search,
      hash: state.hash,
      href: state.href,
      logicalPath: state.logicalPath,
      searchParams: state.searchParams,
      isNavigating,
      navigate,
      replace,
      prefetch,
    }),
    [
      isNavigating,
      navigate,
      prefetch,
      replace,
      state.hash,
      state.href,
      state.logicalPath,
      state.pathname,
      state.search,
      state.searchParams,
    ],
  );

  return (
    <CisecoNavigationContext.Provider value={value}>
      {children}
    </CisecoNavigationContext.Provider>
  );
}

export function useCisecoNavigation() {
  const context = useContext(CisecoNavigationContext);

  if (!context) {
    throw new Error(
      "useCisecoNavigation must be used within CisecoNavigationProvider.",
    );
  }

  return context;
}

export function useCisecoLocation() {
  const {
    pathname,
    search,
    hash,
    href,
    logicalPath,
    searchParams,
  } = useCisecoNavigation();

  return {
    pathname,
    search,
    hash,
    href,
    logicalPath,
    searchParams,
  };
}

export function useCisecoNavigationCapture() {
  const { navigate, prefetch } = useCisecoNavigation();

  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = findClosestAnchor(event.target);
      if (!anchor || shouldIgnoreAnchor(anchor)) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }

      if (navigate(href)) {
        event.preventDefault();
      }
    },
    [navigate],
  );

  const handlePrefetch = useCallback(
    (
      event:
        | MouseEvent<HTMLElement>
        | FocusEvent<HTMLElement>
        | TouchEvent<HTMLElement>,
    ) => {
      const anchor = findClosestAnchor(event.target);
      if (!anchor || shouldIgnoreAnchor(anchor)) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }

      prefetch(href);
    },
    [prefetch],
  );

  return {
    onClickCapture: handleClickCapture,
    onMouseOverCapture: handlePrefetch,
    onFocusCapture: handlePrefetch,
    onTouchStartCapture: handlePrefetch,
  };
}
