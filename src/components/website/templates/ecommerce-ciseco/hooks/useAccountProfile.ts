import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

export type ClientProfile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  avatarUrl: string | null;
};

const EMPTY_PROFILE: ClientProfile = {
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  avatarUrl: null,
};

type ProfileStatus = "loading" | "ready" | "error";

type UseAccountProfileOptions = {
  redirectOnUnauthorized?: boolean;
};

export function useAccountProfile(
  options: UseAccountProfileOptions = {},
) {
  const { redirectOnUnauthorized = true } = options;
  const pathname = usePathname();
  const slug = useMemo(() => {
    if (!pathname) return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "catalogue" && segments[1]) {
      return segments[1];
    }
    return null;
  }, [pathname]);
  const accountQuery = useMemo(
    () => (slug ? `?slug=${encodeURIComponent(slug)}` : ""),
    [slug],
  );
  const loginHref = slug ? `/catalogue/${slug}/login` : "/login";

  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [status, setStatus] = useState<ProfileStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const redirectToLogin = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.assign(loginHref);
    }
  }, [loginHref]);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setStatus("loading");
      setError(null);
      try {
        const response = await fetch(`/api/catalogue/account${accountQuery}`, {
          method: "GET",
        });
        if (response.status === 401 || response.status === 403) {
          if (redirectOnUnauthorized) {
            redirectToLogin();
          }
          return;
        }

        const result = (await response.json()) as
          | { profile: ClientProfile }
          | { error?: string };
        if (!response.ok || !("profile" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : "Unable to load account.",
          );
        }

        if (!active) return;
        setProfile({
          name: result.profile.name ?? "",
          email: result.profile.email ?? "",
          phone: result.profile.phone ?? "",
          address: result.profile.address ?? "",
          notes: result.profile.notes ?? "",
          avatarUrl: result.profile.avatarUrl ?? null,
        });
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : "Unable to load account.";
        setError(message);
        setStatus("error");
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [accountQuery, redirectOnUnauthorized, redirectToLogin]);

  return {
    profile,
    status,
    error,
    loginHref,
  };
}
