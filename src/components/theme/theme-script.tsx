"use client";

import { useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_STORAGE_KEY } from "./theme-constants";

const THEME_SCRIPT = `(function(){try{var storageKey="${THEME_STORAGE_KEY}";var cookieKey="${THEME_COOKIE}";var stored;try{stored=localStorage.getItem(storageKey);}catch(e){stored=null;}var cookies=document.cookie?document.cookie.split("; "):[];var cookieTheme=null;for(var i=0;i<cookies.length;i++){var parts=cookies[i].split("=");if(parts[0]===cookieKey){cookieTheme=decodeURIComponent(parts[1]);break;}}var theme=stored||cookieTheme||"system";var isThemeValue=theme==="light"||theme==="dark"||theme==="system";if(!isThemeValue){theme="system";}var resolved=theme==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;var targets=[document.documentElement,document.body].filter(Boolean);for(var j=0;j<targets.length;j++){var element=targets[j];element.dataset.theme=theme;element.dataset.themeResolved=resolved;element.style.colorScheme=resolved;if(resolved==="dark"){element.classList.add("dark");}else{element.classList.remove("dark");}}}catch(e){}})();`;

const noopSubscribe = () => () => {};

/**
 * Pre-paint theme script. It only matters in the server-rendered HTML, where
 * the browser runs it before first paint. When React creates this element on
 * the client (e.g. a client-side navigation into the app layout), browsers
 * never execute it and React warns; ThemeProvider applies the theme in that
 * case, so the element is rendered as an inert data block (`text/plain`).
 * Server render and hydration keep the executable script unchanged.
 */
export function ThemeScript({ nonce }: { nonce?: string }) {
  const clientOnlyRender = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  return (
    <script
      id="theme-script"
      nonce={nonce}
      type={clientOnlyRender ? "text/plain" : undefined}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
