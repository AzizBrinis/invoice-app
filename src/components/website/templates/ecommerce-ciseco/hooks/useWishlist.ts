import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

export type WishlistProduct = {
  id: string;
  name: string;
  category: string | null;
  saleMode: "INSTANT" | "QUOTE";
  priceHTCents: number | null;
  priceTTCCents: number | null;
  vatRate: number | null;
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
  const { redirectOnLoad = false, redirectOnAction = true } = options;
  const pathname = usePathname();
  const slug = useMemo(() => {
    if (!pathname) return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "catalogue" && segments[1]) {
      return segments[1];
    }
    return null;
  }, [pathname]);
  const query = useMemo(
    () => (slug ? `?slug=${encodeURIComponent(slug)}` : ""),
    [slug],
  );
  const loginHref = slug ? `/catalogue/${slug}/login` : "/login";

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [status, setStatus] = useState<WishlistStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [optimisticIds, setOptimisticIds] = useState<Set<string>>(new Set());

  const redirectToLogin = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.assign(loginHref);
    }
  }, [loginHref]);

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
            : "Unable to load wishlist.",
        );
      }

      setItems(result.items ?? []);
      setOptimisticIds(new Set());
      setStatus("ready");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load wishlist.";
      setStatus("error");
      setError(message);
    }
  }, [query, redirectOnLoad, redirectToLogin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
          throw new Error(result.error ?? "Unable to update wishlist.");
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
          err instanceof Error ? err.message : "Unable to update wishlist.";
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
