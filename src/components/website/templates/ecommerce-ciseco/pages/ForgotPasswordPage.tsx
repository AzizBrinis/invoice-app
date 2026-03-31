import type { CSSProperties } from "react";
import type { ThemeTokens } from "../types";
import type { WebsiteBuilderPageConfig } from "@/lib/website/builder";
import { resolveBuilderSection } from "../builder-helpers";
import { AuthField } from "../components/auth/AuthField";
import { AuthFooterText } from "../components/auth/AuthFooterText";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthPrimaryButton } from "../components/auth/AuthPrimaryButton";
import { ExtraSections } from "../components/builder/ExtraSections";

type ForgotPasswordPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  baseLink: (target: string) => string;
  builder?: WebsiteBuilderPageConfig | null;
};

export function ForgotPasswordPage({
  theme,
  inlineStyles,
  baseLink,
  builder,
}: ForgotPasswordPageProps) {
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle =
    heroSection?.subtitle ?? heroSection?.description ?? undefined;
  const extraSections = sections.filter(
    (section) =>
      section.visible !== false && section.id !== heroSection?.id,
  );
  return (
    <AuthLayout
      theme={theme}
      inlineStyles={inlineStyles}
      title={heroSection?.title ?? "Forgot password"}
      subtitle={
        heroSubtitle ?? "Enter your email address to reset your password"
      }
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
      contentClassName="gap-5"
    >
      <AuthField
        id="forgot-password-email"
        label="Email address"
        type="email"
        placeholder="example@example.com"
      />
      <AuthPrimaryButton label="Continue" />
      <AuthFooterText>
        Go back for{" "}
        <a
          href={baseLink("/login")}
          className="font-semibold text-sky-600 transition-colors hover:text-sky-700"
        >
          Sign in
        </a>{" "}
        /{" "}
        <a
          href={baseLink("/signup")}
          className="font-semibold text-sky-600 transition-colors hover:text-sky-700"
        >
          Sign up
        </a>
      </AuthFooterText>
    </AuthLayout>
  );
}
