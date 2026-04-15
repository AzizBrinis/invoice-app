"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

type UseAutoplayCarouselOptions = {
  itemCount: number;
  intervalMs?: number;
  enabled?: boolean;
};

function normalizeCarouselIndex(index: number, itemCount: number) {
  if (itemCount <= 0) {
    return 0;
  }

  const normalized = index % itemCount;
  return normalized < 0 ? normalized + itemCount : normalized;
}

export function useAutoplayCarousel({
  itemCount,
  intervalMs = 5000,
  enabled = true,
}: UseAutoplayCarouselOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const safeActiveIndex =
    itemCount <= 0 || activeIndex >= itemCount ? 0 : activeIndex;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreference);
      return () => mediaQuery.removeEventListener("change", syncPreference);
    }

    mediaQuery.addListener(syncPreference);
    return () => mediaQuery.removeListener(syncPreference);
  }, []);

  const advanceBy = useEffectEvent((delta: number) => {
    setActiveIndex((current) => {
      const baseIndex = itemCount > 0 && current >= itemCount ? 0 : current;
      return normalizeCarouselIndex(baseIndex + delta, itemCount);
    });
  });

  useEffect(() => {
    if (
      !enabled ||
      itemCount <= 1 ||
      isPaused ||
      prefersReducedMotion ||
      typeof window === "undefined"
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      advanceBy(1);
    }, intervalMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, enabled, intervalMs, isPaused, itemCount, prefersReducedMotion]);

  const goToIndex = useCallback(
    (index: number) => {
      setActiveIndex(normalizeCarouselIndex(index, itemCount));
    },
    [itemCount],
  );

  const goToNext = useCallback(() => {
    setActiveIndex(normalizeCarouselIndex(safeActiveIndex + 1, itemCount));
  }, [itemCount, safeActiveIndex]);

  const goToPrevious = useCallback(() => {
    setActiveIndex(normalizeCarouselIndex(safeActiveIndex - 1, itemCount));
  }, [itemCount, safeActiveIndex]);

  return {
    activeIndex: safeActiveIndex,
    hasControls: itemCount > 1,
    isPaused,
    setIsPaused,
    goToIndex,
    goToNext,
    goToPrevious,
  };
}
