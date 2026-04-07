import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCisecoI18n } from "../i18n";
import { useCisecoLocation, useCisecoNavigation } from "../navigation";

export type WishlistProduct = {
  id: string;
  name: string;
  category: string | null;
  saleMode: "INSTANT" | "QUOTE";
  priceHTCents: number | null;
  priceTTCCents: number | null;
  vatRate: number | null;
  defaultDiscountRate?: number | null;
  defaultDiscountAmountCents?: number | null;
  coverImageUrl: string | null;
  gallery: unknown;
  quoteFormSchema: unknown;
  optionConfig: unknown;
};

export type WishlistItem = {
  id: string;
  productId: string;
  createdAt: string;
  product: WishlistProduct | null;
};

type WishlistStatus = "idle" | "loading" | "ready" | "error";

type UseWishlistOptions = {
  redirectOnLoad?: boolean;
  redirectOnAction?: boolean;
  slug?: string | null;
  loginHref?: string;
  loadStrategy?: "manual" | "idle" | "mount";
};

type WishlistState = {
  items: WishlistItem[];
  status: WishlistStatus;
  error: string | null;
  pendingIds: Set<string>;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  loginHref: string;
};

export function useWishlist(options: UseWishlistOptions = {}): WishlistState {
  const { t } = useCisecoI18n();
  const {
    redirectOnLoad = false,
    redirectOnAction = true,
    slug: explicitSlug,
    loginHref: explicitLoginHref,
    loadStrategy = "mount",
  } = options;
  const { pathname, searchParams } = useCisecoLocation();
  const { navigate } = useCisecoNavigation();
  const slug = useMemo(() => {
    const providedSlug = explicitSlug?.trim();
    if (providedSlug) {
      return providedSlug;
    }

    if (!pathname) return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "catalogue" && segments[1]) {
      return segments[1];
    }
    const querySlug = searchParams.get("slug")?.trim();
    return querySlug || null;
  }, [explicitSlug, pathname, searchParams]);
  const query = useMemo(
    () => (slug ? `?slug=${encodeURIComponent(slug)}` : ""),
    [slug],
  );
  const loginHref =
    explicitLoginHref ?? (slug ? `/catalogue/${slug}/login` : "/login");

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [status, setStatus] = useState<WishlistStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());
  const hasRequestedLoadRef = useRef(false);

  const redirectToLogin = useCallback(() => {
    navigate(loginHref);
  }, [loginHref, navigate]);

  const resolvedIds = useMemo(() => {
    const merged = new Set(items.map((item) => item.productId));
    optimisticIds.forEach((id) => merged.add(id));
    return merged;
  }, [items, optimisticIds]);

  const markPending = useCallback((productId: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(`/api/catalogue/wishlist${query}`, {
        method: "GET",
      });
      if (response.status === 401 || response.status === 403) {
        if (redirectOnLoad) {
          redirectToLogin();
        }
        setStatus("idle");
        return;
      }

      const result = (await response.json()) as
        | { items: WishlistItem[] }
        | { error?: string };
      if (!response.ok || !("items" in result)) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : t("Unable to load wishlist."),
        );
      }

      setItems(result.items ?? []);
      setOptimisticIds(new Set());
      setStatus("ready");
    } catch (err) {
      const message =
        err instanceof Error ? t(err.message) : t("Unable to load wishlist.");
      setStatus("error");
      setError(message);
    }
  }, [query, redirectOnLoad, redirectToLogin, t]);

  useEffect(() => {
    if (loadStrategy === "manual" || hasRequestedLoadRef.current) {
      return;
    }

    hasRequestedLoadRef.current = true;
    if (loadStrategy === "mount") {
      void refresh();
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      const requestId = window.requestIdleCallback(() => {
        void refresh();
      }, { timeout: 1500 });
      return () => {
        window.cancelIdleCallback?.(requestId);
      };
    }

    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 900);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadStrategy, refresh]);

  const updateWishlist = useCallback(
    async (productId: string, method: "POST" | "DELETE") => {
      if (pendingIds.has(productId)) return false;
      markPending(productId, true);
      setError(null);
      try {
        const response = await fetch(`/api/catalogue/wishlist${query}`, {
          method,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ productId }),
        });

        if (response.status === 401 || response.status === 403) {
          if (redirectOnAction) {
            redirectToLogin();
          }
          return false;
        }

        const result = (await response.json()) as { error?: string };
        if (!response.ok || result.error) {
          throw new Error(result.error ?? t("Unable to update wishlist."));
        }

        if (method === "DELETE") {
          setItems((current) =>
            current.filter((item) => item.productId !== productId),
          );
          setOptimisticIds((current) => {
            const next = new Set(current);
            next.delete(productId);
            return next;
          });
        } else {
          setOptimisticIds((current) => {
            const next = new Set(current);
            next.add(productId);
            return next;
          });
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error
            ? t(err.message)
            : t("Unable to update wishlist.");
        setError(message);
        return false;
      } finally {
        markPending(productId, false);
      }
    },
    [
      markPending,
      pendingIds,
      query,
      redirectOnAction,
      redirectToLogin,
      t,
    ],
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const method = resolvedIds.has(productId) ? "DELETE" : "POST";
      return updateWishlist(productId, method);
    },
    [resolvedIds, updateWishlist],
  );

  const isWishlisted = useCallback(
    (productId: string) => resolvedIds.has(productId),
    [resolvedIds],
  );

  return {
    items,
    status,
    error,
    pendingIds,
    isWishlisted,
    toggleWishlist,
    refresh,
    loginHref,
  };
}
