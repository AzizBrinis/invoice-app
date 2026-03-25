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
import {
  AuthSocialButtons,
  type SocialProvider,
} from "../components/auth/AuthSocialButtons";
import type { SignupSettingsInput } from "@/server/website";

type LoginPageProps = {
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

type LoginStatus = "idle" | "loading" | "success" | "error";

type LoginResponse = {
  status: "authenticated" | "preview-only";
  message?: string;
  redirectTo?: string;
};

function resolveLoginRedirectPath(target: SignupSettingsInput["redirectTarget"]) {
  return target === "account" ? "/account" : "/";
}

const PROVIDER_ORDER: SocialProvider[] = ["google", "facebook", "twitter"];

function resolveRedirectUrl(baseLink: (target: string) => string, target: string) {
  if (typeof window === "undefined") {
    return baseLink(target);
  }
  return window.location.pathname.startsWith("/catalogue/")
    ? baseLink(target)
    : target;
}

export function LoginPage({
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
}: LoginPageProps) {
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const socialProviders = useMemo(() => {
    return PROVIDER_ORDER.filter(
      (provider) => signupSettings.providers[provider]?.enabled,
    );
  }, [signupSettings]);

  const redirectPath = resolveLoginRedirectPath(signupSettings.redirectTarget);

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
      setMessage("Please enter an email and password.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/catalogue/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          slug,
          path,
          mode,
        }),
      });

      const result = (await response.json()) as
        | LoginResponse
        | { error?: string };
      if (!response.ok || !("status" in result)) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "Unable to sign in.",
        );
      }

      setStatus("success");
      setMessage(result.message ?? "Login successful.");

      if (result.status !== "preview-only") {
        const redirectTo = result.redirectTo ?? redirectPath;
        const redirectUrl = resolveRedirectUrl(baseLink, redirectTo);
        setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 600);
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to sign in.",
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
      setMessage("Preview mode: no login recorded.");
      return;
    }

    setStatus("error");
    setMessage(
      "Social sign-in is not available yet. Please use email and password.",
    );
  };

  const statusClassName =
    status === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "loading"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const showDivider = socialProviders.length > 0;
  const heroSection = resolveBuilderSection(builder?.sections ?? [], "hero");
  const heroSubtitle =
    heroSection?.subtitle ?? heroSection?.description ?? undefined;

  return (
    <AuthLayout
      theme={theme}
      inlineStyles={inlineStyles}
      title={heroSection?.title ?? "Login"}
      subtitle={heroSubtitle}
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
            id="login-email"
            name="email"
            label="Email"
            type="email"
            placeholder="example@example.com"
            required
            autoComplete="email"
            disabled={status === "loading"}
          />
          <AuthField
            id="login-password"
            name="password"
            label="Password"
            type="password"
            actionLabel="Forgot password?"
            actionHref={baseLink("/forgot-password")}
            required
            autoComplete="current-password"
            disabled={status === "loading"}
          />
        </div>
        <AuthPrimaryButton
          label="Continue"
          type="submit"
          isLoading={status === "loading"}
          disabled={status === "loading"}
          loadingLabel="Signing in..."
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
        New user?{" "}
        <a
          href={baseLink("/signup")}
          className="font-semibold text-sky-600 transition-colors hover:text-sky-700"
        >
          Create an account
        </a>
      </AuthFooterText>
    </AuthLayout>
  );
}
