"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { THEME_COOKIE, THEME_STORAGE_KEY } from "./theme-constants";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const persistThemeChoice = (nextTheme: Theme) => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore write failures (private mode, etc.)
    }
  }

  if (typeof document !== "undefined") {
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `${THEME_COOKIE}=${nextTheme}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
};

const readDatasetTheme = (): Theme | undefined => {
  if (typeof document === "undefined") {
    return undefined;
  }
  const datasetTheme = document.documentElement.dataset.theme;
  if (isTheme(datasetTheme)) {
    return datasetTheme;
  }
  return undefined;
};

const readDatasetResolvedTheme = (): "light" | "dark" | undefined => {
  if (typeof document === "undefined") {
    return undefined;
  }
  const datasetResolved = document.documentElement.dataset.themeResolved;
  if (datasetResolved === "light" || datasetResolved === "dark") {
    return datasetResolved;
  }
  return undefined;
};

const readStoredTheme = (): Theme | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors (private browsing, disabled storage, etc.)
  }

  return undefined;
};

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
    return theme === "system" ? "light" : theme;
  }

  const resolved = theme === "system" ? resolveSystemTheme() : theme;
  const targets: Array<HTMLElement> = [
    document.documentElement,
    document.body,
  ].filter((el): el is HTMLElement => Boolean(el));

  targets.forEach((element) => {
    element.dataset.theme = theme;
    element.dataset.themeResolved = resolved;
    element.classList.toggle("dark", resolved === "dark");
    element.style.colorScheme = resolved;
  });

  return resolved;
};

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const initialThemeValue = useMemo<Theme>(() => {
    const datasetTheme = readDatasetTheme();
    const storedTheme = readStoredTheme();
    return datasetTheme ?? storedTheme ?? initialTheme;
  }, [initialTheme]);

  const initialResolvedValue = useMemo<"light" | "dark">(() => {
    const datasetResolved = readDatasetResolvedTheme();
    if (datasetResolved) {
      return datasetResolved;
    }
    return initialThemeValue === "system"
      ? resolveSystemTheme()
      : initialThemeValue;
  }, [initialThemeValue]);

  const [theme, setThemeState] = useState<Theme>(initialThemeValue);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    initialResolvedValue,
  );

  const applyTheme = useCallback(
    (nextTheme: Theme) => {
      const resolved = applyThemeToDocument(nextTheme);
      setResolvedTheme((current) => (current === resolved ? current : resolved));
    },
    [],
  );

  const changeTheme = useCallback(
    (next: Theme) => {
      if (!isTheme(next)) {
        return;
      }

      setThemeState((current) => (current === next ? current : next));
      applyTheme(next);
      persistThemeChoice(next);
    },
    [applyTheme],
  );

  useEffect(() => {
    persistThemeChoice(theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      applyTheme("system");
    };

    media.addEventListener("change", listener);

    return () => {
      media.removeEventListener("change", listener);
    };
  }, [applyTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: changeTheme,
    }),
    [changeTheme, theme, resolvedTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    const fallbackTheme = readDatasetTheme() ?? "system";
    const fallbackResolved =
      fallbackTheme === "system" ? resolveSystemTheme() : fallbackTheme;

    return {
      theme: fallbackTheme,
      resolvedTheme: fallbackResolved,
      setTheme: (next: Theme) => {
        if (!isTheme(next)) {
          return;
        }
        applyThemeToDocument(next);
        persistThemeChoice(next);
      },
    };
  }
  return context;
}
