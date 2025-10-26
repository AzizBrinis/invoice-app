"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (next: Theme) => void;
};

const THEME_STORAGE_KEY = "invoices-app-theme";
const THEME_COOKIE = "theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const resolveSystemTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === "undefined") {
    return "light";
  }

  const element = document.documentElement;
  const resolved = theme === "system" ? resolveSystemTheme() : theme;

  element.dataset.theme = theme;
  element.dataset.themeResolved = resolved;
  element.classList.toggle("dark", resolved === "dark");
  element.style.colorScheme = resolved;

  return resolved;
};

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    initialTheme === "dark" ? "dark" : "light",
  );

  const persistTheme = useCallback((nextTheme: Theme) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore write failures (private mode, etc.)
    }

    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `${THEME_COOKIE}=${nextTheme}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, []);

  const updateTheme = useCallback(
    (nextTheme: Theme, { persist }: { persist: boolean }) => {
      setThemeState(nextTheme);
      const resolved = applyThemeToDocument(nextTheme);
      setResolvedTheme(resolved);
      if (persist) {
        persistTheme(nextTheme);
      }
    },
    [persistTheme],
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      const element = document.documentElement;
      const datasetTheme = element.dataset.theme;
      const datasetResolved = element.dataset.themeResolved;

      startTransition(() => {
        if (isTheme(datasetTheme)) {
          setThemeState(datasetTheme);
        }
        if (datasetResolved === "dark" || datasetResolved === "light") {
          setResolvedTheme(datasetResolved);
        }
      });
    }

    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme = isTheme(stored) ? stored : initialTheme;

    startTransition(() => {
      updateTheme(nextTheme, { persist: false });
    });
  }, [initialTheme, updateTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const resolved = applyThemeToDocument("system");
      setResolvedTheme(resolved);
    };
    media.addEventListener("change", listener);
    return () => {
      media.removeEventListener("change", listener);
    };
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        if (!isTheme(next)) {
          return;
        }
        updateTheme(next, { persist: true });
      },
    }),
    [theme, resolvedTheme, updateTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function ThemeScript() {
  const script = `(function(){try{var storageKey="${THEME_STORAGE_KEY}";var cookieKey="${THEME_COOKIE}";var stored;try{stored=localStorage.getItem(storageKey);}catch(e){stored=null;}var cookies=document.cookie?document.cookie.split("; "):[];var cookieTheme=null;for(var i=0;i<cookies.length;i++){var parts=cookies[i].split("=");if(parts[0]===cookieKey){cookieTheme=decodeURIComponent(parts[1]);break;}}var theme=stored||cookieTheme||"system";var isThemeValue=theme==="light"||theme==="dark"||theme==="system";if(!isThemeValue){theme="system";}var resolved=theme==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;var element=document.documentElement;element.dataset.theme=theme;element.dataset.themeResolved=resolved;element.style.colorScheme=resolved;if(resolved==="dark"){element.classList.add("dark");}else{element.classList.remove("dark");}}catch(e){}})();`;

  return (
    <script
      id="theme-script"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
