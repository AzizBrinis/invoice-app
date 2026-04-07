"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import { AccountTabs } from "../components/account/AccountTabs";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useAccountProfile } from "../hooks/useAccountProfile";
import { useCisecoI18n } from "../i18n";
import { useCisecoLocation, useCisecoNavigation } from "../navigation";

type AccountPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type ClientProfile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  companyName: string;
  vatNumber: string;
  avatarUrl: string | null;
};

type EditableProfileField = "name" | "email" | "phone" | "address" | "notes";

const EMPTY_PROFILE: ClientProfile = {
  name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  companyName: "",
  vatNumber: "",
  avatarUrl: null,
};

const inputClassName =
  "w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const textareaClassName =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const labelClassName = "text-xs font-semibold text-slate-700";

export function AccountPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: AccountPageProps) {
  const { t } = useCisecoI18n();
  const { pathname } = useCisecoLocation();
  const { navigate } = useCisecoNavigation();
  const {
    profile: accountProfile,
    applyAuthenticatedProfile,
  } = useAccountProfile({
    redirectOnUnauthorized: true,
  });
  const slug = useMemo(() => {
    if (!pathname) return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "catalogue" && segments[1]) {
      return segments[1];
    }
    return null;
  }, [pathname]);
  const accountQuery = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  const loginHref = slug ? `/catalogue/${slug}/login` : "/login";

  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasDraftChanges || isSaving) {
      return;
    }
    setProfile({
      name: accountProfile.name ?? "",
      email: accountProfile.email ?? "",
      phone: accountProfile.phone ?? "",
      address: accountProfile.address ?? "",
      notes: accountProfile.notes ?? "",
      companyName: accountProfile.companyName ?? "",
      vatNumber: accountProfile.vatNumber ?? "",
      avatarUrl: accountProfile.avatarUrl ?? null,
    });
  }, [accountProfile, hasDraftChanges, isSaving]);

  const handleFieldChange = useCallback(
    (field: EditableProfileField) =>
      (
        event:
          | ChangeEvent<HTMLInputElement>
          | ChangeEvent<HTMLTextAreaElement>,
      ) => {
        const value = event.target.value;
        setUpdateStatus("idle");
        setUpdateMessage(null);
        setHasDraftChanges(true);
        setProfile((current) => ({
          ...current,
          [field]: value,
        }));
      },
    [],
  );

  const handleUpdate = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setUpdateStatus("loading");
    setUpdateMessage(t("Updating account..."));
    try {
      const response = await fetch(`/api/catalogue/account${accountQuery}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          address: profile.address,
          notes: profile.notes,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        navigate(loginHref);
        return;
      }

      const result = (await response.json()) as
        | { profile: ClientProfile }
        | { error?: string };
      if (!response.ok || !("profile" in result)) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : t("Unable to update account."),
        );
      }

      const nextProfile = {
        name: result.profile.name ?? "",
        email: result.profile.email ?? "",
        phone: result.profile.phone ?? "",
        address: result.profile.address ?? "",
        notes: result.profile.notes ?? "",
        companyName: result.profile.companyName ?? "",
        vatNumber: result.profile.vatNumber ?? "",
        avatarUrl: result.profile.avatarUrl ?? null,
      };
      setProfile(nextProfile);
      setHasDraftChanges(false);
      applyAuthenticatedProfile(nextProfile);
      setUpdateStatus("success");
      setUpdateMessage(t("Account updated."));
    } catch (error) {
      console.error("[AccountPage] Failed to update profile", error);
      setUpdateStatus("error");
      setUpdateMessage(
        error instanceof Error
          ? t(error.message)
          : t("Unable to update account."),
      );
    } finally {
      setIsSaving(false);
    }
  }, [accountQuery, applyAuthenticatedProfile, isSaving, loginHref, navigate, profile, t]);

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
                  {profile.name}
                </span>
                {headerDetails ? `, ${headerDetails}` : null}
              </p>
            </div>
            <div className="mt-6 border-y border-black/5">
              <AccountTabs activeTab="Settings" />
            </div>
            <section className="mt-10">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                {t("Account information")}
              </h2>
              <div className="mt-6">
                <AccountForm
                  theme={theme}
                  values={profile}
                  onFieldChange={handleFieldChange}
                  onSubmit={handleUpdate}
                  isSaving={isSaving}
                  updateMessage={updateMessage}
                  updateStatus={updateStatus}
                  t={t}
                />
              </div>
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

type AccountFormProps = {
  theme: ThemeTokens;
  values: ClientProfile;
  onFieldChange: (
    field: EditableProfileField,
  ) => (
    event:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  onSubmit: () => void;
  isSaving: boolean;
  updateStatus: "idle" | "loading" | "success" | "error";
  updateMessage: string | null;
  t: (text: string) => string;
};

function AccountForm({
  theme,
  values,
  onFieldChange,
  onSubmit,
  isSaving,
  updateStatus,
  updateMessage,
  t,
}: AccountFormProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="account-name" className={labelClassName}>
          {t("Full name")}
        </label>
        <input
          id="account-name"
          type="text"
          value={values.name}
          onChange={onFieldChange("name")}
          className={inputClassName}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="account-email" className={labelClassName}>
          {t("Email")}
        </label>
        <div className="relative">
          <MailIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="account-email"
            type="email"
            value={values.email}
            onChange={onFieldChange("email")}
            className={clsx(inputClassName, "pl-10")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="account-birth" className={labelClassName}>
          {t("Date of birth")}
        </label>
        <div className="relative">
          <CalendarIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="account-birth"
            type="text"
            defaultValue=""
            className={clsx(inputClassName, "pl-10 pr-10")}
          />
          <CalendarMiniIcon className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="account-address" className={labelClassName}>
          {t("Address")}
        </label>
        <div className="relative">
          <MapPinIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="account-address"
            type="text"
            value={values.address}
            onChange={onFieldChange("address")}
            className={clsx(inputClassName, "pl-10")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="account-gender" className={labelClassName}>
          {t("Gender")}
        </label>
        <div className="relative">
          <select
            id="account-gender"
            defaultValue="male"
            className={clsx(inputClassName, "appearance-none pr-10")}
          >
            <option value="male">{t("Male")}</option>
            <option value="female">{t("Female")}</option>
            <option value="other">{t("Other")}</option>
          </select>
          <ChevronDownIcon className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="account-phone" className={labelClassName}>
          {t("Phone number")}
        </label>
        <div className="relative">
          <PhoneIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="account-phone"
            type="tel"
            value={values.phone}
            onChange={onFieldChange("phone")}
            className={clsx(inputClassName, "pl-10")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="account-about" className={labelClassName}>
          {t("About you")}
        </label>
        <textarea
          id="account-about"
          rows={4}
          value={values.notes}
          onChange={onFieldChange("notes")}
          className={textareaClassName}
        />
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSaving}
        aria-busy={isSaving}
        className={clsx(
          theme.buttonShape,
          "inline-flex w-full items-center justify-center gap-2 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-80 sm:w-auto",
        )}
      >
        {isSaving ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white"
            aria-hidden="true"
          />
        ) : null}
        {isSaving ? t("Updating...") : t("Update account")}
      </button>
      {updateMessage ? (
        <p
          className={clsx(
            "text-sm",
            updateStatus === "error"
              ? "text-rose-600"
              : updateStatus === "success"
                ? "text-emerald-600"
                : "text-slate-500",
          )}
        >
          {updateMessage}
        </p>
      ) : null}
    </div>
  );
}

type IconProps = {
  className?: string;
};

function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 7.5C4 6.1 5.1 5 6.5 5h11c1.4 0 2.5 1.1 2.5 2.5v9c0 1.4-1.1 2.5-2.5 2.5h-11C5.1 19 4 17.9 4 16.5v-9z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M5 7l7 5 7-5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="4"
        y="5.5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M8 3.5v4M16 3.5v4M4 9.5h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarMiniIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="6.5"
        y="7"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M9 5.5v3M15 5.5v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapPinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10.2a6 6 0 1 0-12 0C6 15.8 12 21 12 21z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        cx="12"
        cy="10.5"
        r="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function PhoneIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="7"
        y="3.5"
        width="10"
        height="17"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
