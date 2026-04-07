"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { ThemeTokens } from "../types";
import type { WebsiteBuilderPageConfig } from "@/lib/website/builder";
import { resolveBuilderSection } from "../builder-helpers";
import { AuthDivider } from "../components/auth/AuthDivider";
import { AuthField } from "../components/auth/AuthField";
import { AuthFooterText } from "../components/auth/AuthFooterText";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthPrimaryButton } from "../components/auth/AuthPrimaryButton";
import { ExtraSections } from "../components/builder/ExtraSections";
import {
  AuthSocialButtons,
  type SocialProvider,
} from "../components/auth/AuthSocialButtons";
import type { SignupSettingsInput } from "@/server/website";
import {
  useAccountProfile,
  type ClientProfile,
} from "../hooks/useAccountProfile";
import { useCisecoI18n } from "../i18n";
import { useCisecoNavigation } from "../navigation";

type SignupPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  baseLink: (target: string) => string;
  mode: "public" | "preview";
  slug: string;
  path?: string | null;
  signupSettings: SignupSettingsInput;
  builder?: WebsiteBuilderPageConfig | null;
};

type SignupStatus = "idle" | "loading" | "success" | "error";

type SignupResponse = {
  status: "created" | "existing" | "preview-only";
  message?: string;
  redirectTo?: string;
  profile?: ClientProfile | null;
};

const PROVIDER_ORDER: SocialProvider[] = ["google", "facebook", "twitter"];

function resolveSignupRedirectPath(target: SignupSettingsInput["redirectTarget"]) {
  return target === "account" ? "/account" : "/";
}

export function SignupPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  baseLink,
  mode,
  slug,
  path,
  signupSettings,
  builder,
}: SignupPageProps) {
  const { t } = useCisecoI18n();
  const { navigate } = useCisecoNavigation();
  const { applyAuthenticatedProfile } = useAccountProfile({
    redirectOnUnauthorized: false,
  });
  const [status, setStatus] = useState<SignupStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const socialProviders = useMemo(() => {
    return PROVIDER_ORDER.filter(
      (provider) => signupSettings.providers[provider]?.enabled,
    );
  }, [signupSettings]);

  const redirectPath = useMemo(
    () => resolveSignupRedirectPath(signupSettings.redirectTarget),
    [signupSettings.redirectTarget],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading") {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    if (!email || !password) {
      setStatus("error");
      setMessage(t("Please enter an email and password."));
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/catalogue/signup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          intent: "password",
          email,
          password,
          slug,
          path,
          mode,
        }),
      });
      const result = (await response.json()) as
        | SignupResponse
        | { error?: string };
      if (!response.ok || !("status" in result)) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : t("Unable to create account."),
        );
      }

      setStatus("success");
      setMessage(t(result.message ?? "Signup successful."));

      if (result.status !== "preview-only") {
        if (result.profile) {
          applyAuthenticatedProfile(result.profile);
        }
        const redirectTo = result.redirectTo ?? redirectPath;
        setTimeout(() => {
          navigate(baseLink(redirectTo));
        }, 600);
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? t(error.message)
          : t("Unable to create account."),
      );
    }
  };

  const handleProviderClick = (provider: SocialProvider) => {
    void provider;
    if (status === "loading") {
      return;
    }
    if (mode === "preview") {
      setStatus("success");
      setMessage(t("Preview mode: no signup recorded."));
      return;
    }

    setStatus("error");
    setMessage(
      t("Social signup is not available yet. Please use email and password."),
    );
  };

  const showDivider = socialProviders.length > 0;
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle =
    heroSection?.subtitle ?? heroSection?.description ?? undefined;
  const extraSections = sections.filter(
    (section) =>
      section.visible !== false && section.id !== heroSection?.id,
  );
  const statusClassName =
    status === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "loading"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <AuthLayout
      theme={theme}
      inlineStyles={inlineStyles}
      title={t(heroSection?.title ?? "Sign up")}
      subtitle={heroSubtitle}
      builderSectionId={heroSection?.id}
      belowContent={
        extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null
      }
      chrome={{ companyName, homeHref }}
    >
      {socialProviders.length > 0 ? (
        <AuthSocialButtons
          providers={socialProviders}
          disabled={status === "loading" || mode === "preview"}
          onProviderClick={handleProviderClick}
        />
      ) : null}
      {showDivider ? <AuthDivider /> : null}
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <AuthField
            id="signup-email"
            name="email"
            label={t("Email")}
            type="email"
            placeholder={t("example@example.com")}
            required
            autoComplete="email"
            disabled={status === "loading"}
          />
          <AuthField
            id="signup-password"
            name="password"
            label={t("Password")}
            type="password"
            required
            autoComplete="new-password"
            disabled={status === "loading"}
          />
        </div>
        <AuthPrimaryButton
          label={t("Continue")}
          type="submit"
          isLoading={status === "loading"}
          disabled={status === "loading"}
          loadingLabel={t("Creating account...")}
        />
        {message ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm ${statusClassName}`}
          >
            {message}
          </p>
        ) : null}
      </form>
      <AuthFooterText>
        {t("Already have an account?")}{" "}
        <a
          href={baseLink("/login")}
          className="font-semibold text-sky-600 transition-colors hover:text-sky-700"
        >
          {t("Sign in")}
        </a>
      </AuthFooterText>
    </AuthLayout>
  );
}
