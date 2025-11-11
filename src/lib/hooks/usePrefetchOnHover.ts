"use client";

import { useCallback, useRef } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

export function usePrefetchOnHover(path: Route | string) {
  const router = useRouter();
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetched.current) {
      return;
    }
    prefetched.current = true;
    try {
      const target = path as Route;
      router.prefetch(target);
    } catch {
      prefetched.current = false;
    }
  }, [path, router]);

  return {
    onMouseEnter: prefetch,
    onFocus: prefetch,
    onTouchStart: prefetch,
  };
}
