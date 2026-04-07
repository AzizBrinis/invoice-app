"use client";

import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { AccountTabs } from "../components/account/AccountTabs";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";
import { useAccountProfile } from "../hooks/useAccountProfile";
import { useCisecoLocation, useCisecoNavigation } from "../navigation";

type ChangePasswordPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

const inputClassName =
  "w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const labelClassName = "text-xs font-semibold text-slate-700";

export function ChangePasswordPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: ChangePasswordPageProps) {
  const { t } = useCisecoI18n();
  const { pathname } = useCisecoLocation();
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
  const loginHref = useMemo(
    () => (slug ? `/catalogue/${slug}/login` : "/login"),
    [slug],
  );
  const { profile, status: profileStatus } = useAccountProfile({
    redirectOnUnauthorized: true,
  });
  const headerDetails = useMemo(() => {
    const parts = [profile.email, profile.address].filter(
      (value) => value && value.trim().length > 0,
    ) as string[];
    return parts.join(" · ");
  }, [profile.address, profile.email]);
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const consumedIds = new Set(
    [heroSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) =>
      section.visible !== false && !consumedIds.has(section.id),
  );

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        <div
          className={clsx(
            "mx-auto px-6 pb-20 pt-8 sm:px-8 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          <div className="mx-auto max-w-[760px]">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {t(heroSection?.title ?? "Account")}
              </h1>
              {heroSubtitle ? (
                <p className="text-sm text-slate-600">{t(heroSubtitle)}</p>
              ) : null}
              <p className="text-sm text-slate-500 sm:text-base">
                <span className="font-semibold text-slate-900">
                  {profile.name ||
                    (profileStatus === "loading" ? t("Loading...") : "—")}
                </span>
                {headerDetails
                  ? `, ${headerDetails}`
                  : profileStatus === "loading"
                    ? ` · ${t("Loading details...")}`
                    : null}
              </p>
            </div>
            <div className="mt-6 border-y border-black/5">
              <AccountTabs activeTab="Change password" />
            </div>
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {t("Update your password")}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {t("Update your password to keep your account secure.")}
              </p>
              <PasswordForm
                theme={theme}
                accountQuery={accountQuery}
                loginHref={loginHref}
              />
            </section>
          </div>
        </div>
        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer
        theme={theme}
        companyName={companyName}
        homeHref={homeHref}
        spacing="compact"
      />
    </PageShell>
  );
}

type PasswordFormProps = {
  theme: ThemeTokens;
  accountQuery: string;
  loginHref: string;
};

function PasswordForm({ theme, accountQuery, loginHref }: PasswordFormProps) {
  const { t } = useCisecoI18n();
  const { navigate } = useCisecoNavigation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  const resetMessage = useCallback(() => {
    setStatus("idle");
    setMessage(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (status === "loading") return;
    resetMessage();

    if (!currentPassword) {
      setStatus("error");
      setMessage(t("Please enter your current password."));
      return;
    }
    if (nextPassword.length < 8) {
      setStatus("error");
      setMessage(t("New password must be at least 8 characters."));
      return;
    }
    if (nextPassword !== confirmPassword) {
      setStatus("error");
      setMessage(t("New password and confirmation do not match."));
      return;
    }

    setStatus("loading");
    setMessage(t("Updating password..."));
    try {
      const response = await fetch(
        `/api/catalogue/account/password${accountQuery}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword: nextPassword,
            confirmPassword,
          }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        navigate(loginHref);
        return;
      }

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(result.message || t("Unable to update password."));
      }

      setStatus("success");
      setMessage(t(result.message || "Password updated successfully."));
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? t(error.message)
          : t("Unable to update password."),
      );
    }
  }, [
    accountQuery,
    confirmPassword,
    currentPassword,
    loginHref,
    navigate,
    nextPassword,
    resetMessage,
    status,
    t,
  ]);

  return (
    <div className="mt-6 w-full max-w-[440px] space-y-5">
      <div className="space-y-2">
        <label htmlFor="current-password" className={labelClassName}>
          {t("Current password")}
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(event) => {
            resetMessage();
            setCurrentPassword(event.target.value);
          }}
          className={inputClassName}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="new-password" className={labelClassName}>
          {t("New password")}
        </label>
        <input
          id="new-password"
          type="password"
          value={nextPassword}
          onChange={(event) => {
            resetMessage();
            setNextPassword(event.target.value);
          }}
          className={inputClassName}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm-password" className={labelClassName}>
          {t("Confirm password")}
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => {
            resetMessage();
            setConfirmPassword(event.target.value);
          }}
          className={inputClassName}
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        className={clsx(
          theme.buttonShape,
          "inline-flex w-full items-center justify-center gap-2 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-80 sm:w-auto",
        )}
      >
        {status === "loading" ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white"
            aria-hidden="true"
          />
        ) : null}
        {status === "loading" ? t("Updating...") : t("Update password")}
      </button>
      {message ? (
        <p
          className={clsx(
            "text-sm",
            status === "error"
              ? "text-rose-600"
              : status === "success"
                ? "text-emerald-600"
                : "text-slate-500",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
