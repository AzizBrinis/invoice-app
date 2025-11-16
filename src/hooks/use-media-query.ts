"use client";

import { useSyncExternalStore } from "react";

function getMediaQuery(query: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(query);
}

function getSnapshot(query: string) {
  const mediaQuery = getMediaQuery(query);
  return mediaQuery?.matches ?? false;
}

function subscribeToMediaQuery(query: string, callback: () => void) {
  const mediaQuery = getMediaQuery(query);
  if (!mediaQuery) {
    return () => undefined;
  }

  const handler = () => callback();

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }

  mediaQuery.addListener(handler);
  return () => mediaQuery.removeListener(handler);
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => subscribeToMediaQuery(query, callback),
    () => getSnapshot(query),
    () => false,
  );
}
