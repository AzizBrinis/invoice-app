"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_CATALOG_CLIENT_PROFILE,
  type CatalogClientProfile as ClientProfile,
  type CatalogViewerState,
} from "@/lib/catalog-viewer";
import { useCisecoI18n } from "../i18n";
import { useCisecoLocation, useCisecoNavigation } from "../navigation";

type ProfileStatus = "loading" | "ready" | "error" | "unauthenticated";

type AccountProfileContextValue = {
  profile: ClientProfile;
  status: ProfileStatus;
  authStatus: CatalogViewerState["authStatus"];
  error: string | null;
  loginHref: string;
  applyAuthenticatedProfile: (profile: ClientProfile) => void;
  clearProfile: () => void;
  refreshProfile: () => void;
};

type AccountProfileProviderProps = {
  children: ReactNode;
  initialViewer?: CatalogViewerState | null;
};

type UseAccountProfileOptions = {
  redirectOnUnauthorized?: boolean;
};

const AccountProfileContext =
  createContext<AccountProfileContextValue | null>(null);

function resolveSlug(pathname: string | null) {
  if (!pathname) return null;
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "catalogue" && segments[1]) {
    return segments[1];
  }
  return null;
}

function normalizeProfile(profile: ClientProfile | null | undefined) {
  return profile ?? EMPTY_CATALOG_CLIENT_PROFILE;
}

export function AccountProfileProvider({
  children,
  initialViewer,
}: AccountProfileProviderProps) {
  const { t } = useCisecoI18n();
  const { pathname } = useCisecoLocation();
  const slug = useMemo(() => resolveSlug(pathname), [pathname]);
  const accountQuery = useMemo(
    () => (slug ? `?slug=${encodeURIComponent(slug)}` : ""),
    [slug],
  );
  const loginHref = useMemo(
    () => (slug ? `/catalogue/${slug}/login` : "/login"),
    [slug],
  );

  const [profile, setProfile] = useState<ClientProfile>(() =>
    normalizeProfile(initialViewer?.profile),
  );
  const [status, setStatus] = useState<ProfileStatus>(() =>
    initialViewer?.authStatus === "authenticated" ? "ready" : "loading",
  );
  const [authStatus, setAuthStatus] = useState<
    CatalogViewerState["authStatus"]
  >(() => initialViewer?.authStatus ?? "unauthenticated");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const authStatusRef = useRef<CatalogViewerState["authStatus"]>(authStatus);

  useEffect(() => {
    authStatusRef.current = authStatus;
  }, [authStatus]);

  const applyAuthenticatedProfile = useCallback((nextProfile: ClientProfile) => {
    setProfile(normalizeProfile(nextProfile));
    setAuthStatus("authenticated");
    setStatus("ready");
    setError(null);
  }, []);

  const clearProfile = useCallback(() => {
    setProfile(EMPTY_CATALOG_CLIENT_PROFILE);
    setAuthStatus("unauthenticated");
    setStatus("unauthenticated");
    setError(null);
  }, []);

  const refreshProfile = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const preserveAuthenticatedState =
      authStatusRef.current === "authenticated";

    if (!preserveAuthenticatedState) {
      setStatus("loading");
    }
    setError(null);

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/catalogue/account${accountQuery}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!active) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          clearProfile();
          return;
        }

        const result = (await response.json()) as
          | { profile: ClientProfile }
          | { error?: string };
        if (!response.ok || !("profile" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : t("Unable to load account."),
          );
        }

        applyAuthenticatedProfile(result.profile);
      } catch (err) {
        if (!active) {
          return;
        }

        const message =
          err instanceof Error ? t(err.message) : t("Unable to load account.");
        setError(message);

        if (!preserveAuthenticatedState) {
          setStatus("error");
        }
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [accountQuery, applyAuthenticatedProfile, clearProfile, pathname, refreshKey, t]);

  const value = useMemo<AccountProfileContextValue>(
    () => ({
      profile,
      status,
      authStatus,
      error,
      loginHref,
      applyAuthenticatedProfile,
      clearProfile,
      refreshProfile,
    }),
    [
      applyAuthenticatedProfile,
      authStatus,
      clearProfile,
      error,
      loginHref,
      profile,
      refreshProfile,
      status,
    ],
  );

  return (
    <AccountProfileContext.Provider value={value}>
      {children}
    </AccountProfileContext.Provider>
  );
}

export function useAccountProfile(
  options: UseAccountProfileOptions = {},
) {
  const context = useContext(AccountProfileContext);
  const { navigate } = useCisecoNavigation();
  const { redirectOnUnauthorized = true } = options;

  if (!context) {
    throw new Error(
      "useAccountProfile must be used within AccountProfileProvider.",
    );
  }

  useEffect(() => {
    if (!redirectOnUnauthorized || context.authStatus !== "unauthenticated") {
      return;
    }

    navigate(context.loginHref);
  }, [context.authStatus, context.loginHref, navigate, redirectOnUnauthorized]);

  return context;
}

export type { ClientProfile, ProfileStatus };
