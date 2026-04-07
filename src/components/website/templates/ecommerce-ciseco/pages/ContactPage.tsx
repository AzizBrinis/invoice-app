import clsx from "clsx";
import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import type { WebsiteBuilderPageConfig, WebsiteBuilderSection } from "@/lib/website/builder";
import {
  CONTACT_SOCIAL_ICON_COLORS,
  CONTACT_SOCIAL_ICON_LABELS,
  type ContactSocialIcon,
  type ContactSocialLink,
} from "@/lib/website/contact";
import type { ThemeTokens } from "../types";
import {
  resolveBuilderMedia,
  resolveBuilderSectionBySignature,
} from "../builder-helpers";
import { PromoBlock } from "../components/about/PromoBlock";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { useCisecoI18n } from "../i18n";

type ContactPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  contactIntro?: string | null;
  contact: {
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  socialLinks?: ContactSocialLink[];
  slug: string;
  mode: "public" | "preview";
  path?: string | null;
  spamProtectionEnabled: boolean;
  builder?: WebsiteBuilderPageConfig | null;
};

const inputClassName =
  "w-full rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const textareaClassName =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const labelClassName = "text-xs font-semibold text-slate-700";

const SOCIAL_ICON_COMPONENTS: Record<
  ContactSocialIcon,
  (props: IconProps) => JSX.Element
> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  twitter: TwitterIcon,
  youtube: YouTubeIcon,
  telegram: TelegramIcon,
  whatsapp: WhatsAppIcon,
  github: GitHubIcon,
};

const DEFAULT_SUCCESS_MESSAGE = "Thanks! Your message has been sent.";

export function ContactPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  contactIntro,
  contact,
  socialLinks,
  slug,
  mode,
  path,
  spamProtectionEnabled,
  builder,
}: ContactPageProps) {
  const { t } = useCisecoI18n();
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const hasBuilder = Boolean(builder);
  const heroSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-contact-hero",
    type: "hero",
    layouts: ["page-hero", "split"],
  });
  const promoSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-contact-promo",
    type: "promo",
    layouts: "banner",
  });
  const showHero = heroSection ? heroSection.visible !== false : !hasBuilder;
  const showPromo = promoSection ? promoSection.visible !== false : !hasBuilder;
  const title = heroSection?.title ?? "Contact";
  const introOverride =
    heroSection?.subtitle ?? heroSection?.description ?? null;
  const promoImage = resolveBuilderMedia(promoSection?.mediaId, mediaLibrary);
  const promoButtons =
    promoSection?.buttons?.length
      ? promoSection.buttons.map((button) => ({
          label: button.label ?? "CTA",
          href: button.href ?? "#",
        }))
      : null;
  const consumedIds = new Set(
    [heroSection, promoSection]
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
            "mx-auto px-6 pb-12 pt-10 sm:px-8 lg:pb-16 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={showHero ? heroSection?.id : undefined}
        >
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:gap-16">
            <div className="space-y-6">
              {showHero ? (
                <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                  {t(title)}
                </h1>
              ) : null}
              <ContactDetails
                intro={introOverride ?? contactIntro}
                address={contact.address}
                email={contact.email}
                phone={contact.phone}
                socialLinks={socialLinks}
              />
            </div>
            <ContactForm
              theme={theme}
              slug={slug}
              mode={mode}
              path={path}
              spamProtectionEnabled={spamProtectionEnabled}
            />
          </div>
        </div>
        <div className={clsx("mx-auto px-6 sm:px-8", theme.containerClass)}>
          <div className="border-t border-black/5" />
        </div>
        {showPromo ? (
          <PromoBlock
            theme={theme}
            companyName={companyName}
            homeHref={homeHref}
            title={promoSection?.title ?? null}
            description={promoSection?.description ?? promoSection?.subtitle ?? null}
            buttons={promoButtons}
            image={
              promoImage?.src
                ? { src: promoImage.src, alt: promoImage.alt || "Promo" }
                : null
            }
            sectionId={promoSection?.id}
          />
        ) : null}
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

type ContactDetailsProps = {
  intro?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  socialLinks?: ContactSocialLink[];
};

function ContactDetails({
  intro,
  address,
  email,
  phone,
  socialLinks,
}: ContactDetailsProps) {
  const { t } = useCisecoI18n();
  const resolvedSocialLinks =
    socialLinks?.filter((link) => link.href) ?? [];
  return (
    <div className="space-y-6">
      {intro ? (
        <p className="max-w-[380px] text-sm leading-relaxed text-slate-500">
          {intro}
        </p>
      ) : null}
      {address ? (
        <ContactInfoItem icon={MapPinIcon} label={t("Address")}>
          <p className="max-w-[320px] text-sm leading-relaxed text-slate-500">
            {address}
          </p>
        </ContactInfoItem>
      ) : null}
      {email ? (
        <ContactInfoItem icon={MailIcon} label={t("Email")}>
          <a
            className="text-sm text-slate-500 hover:text-slate-700"
            href={`mailto:${email}`}
          >
            {email}
          </a>
        </ContactInfoItem>
      ) : null}
      {phone ? (
        <ContactInfoItem icon={PhoneIcon} label={t("Phone")}>
          <a
            className="text-sm text-slate-500 hover:text-slate-700"
            href={`tel:${phone}`}
          >
            {phone}
          </a>
        </ContactInfoItem>
      ) : null}
      {resolvedSocialLinks.length ? (
        <ContactInfoItem icon={GlobeIcon} label={t("Socials")}>
          <div className="flex flex-wrap items-center gap-3">
            {resolvedSocialLinks.map((link) => {
              const Icon = SOCIAL_ICON_COMPONENTS[link.icon] ?? GlobeIcon;
              const color =
                CONTACT_SOCIAL_ICON_COLORS[link.icon] ?? "#0f172a";
              const label =
                link.label || CONTACT_SOCIAL_ICON_LABELS[link.icon] || t("Social");
              return (
                <SocialLink
                  key={link.id}
                  label={label}
                  href={link.href}
                  color={color}
                >
                  <Icon className="h-4 w-4" />
                </SocialLink>
              );
            })}
          </div>
        </ContactInfoItem>
      ) : null}
    </div>
  );
}

type ContactFormProps = {
  theme: ThemeTokens;
  slug: string;
  mode: "public" | "preview";
  path?: string | null;
  spamProtectionEnabled: boolean;
};

function ContactForm({
  theme,
  slug,
  mode,
  path,
  spamProtectionEnabled,
}: ContactFormProps) {
  const { t } = useCisecoI18n();
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolvedPath = useMemo(() => {
    if (path) return path;
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "/";
  }, [path]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setFeedback(null);
    setError(null);

    if (mode === "preview") {
      setStatus("success");
      setFeedback(t("Preview mode: no data is saved."));
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("slug", slug);
    formData.set("mode", mode);
    formData.set("path", resolvedPath);

    try {
      const response = await fetch("/api/catalogue/contact-messages", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        status?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || result.error) {
        throw new Error(
          result.error ?? t("Unable to send your message."),
        );
      }
      form.reset();
      setStatus("success");
      setFeedback(t(result.message ?? DEFAULT_SUCCESS_MESSAGE));
    } catch (submissionError) {
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? t(submissionError.message)
          : t("Unable to send your message."),
      );
    }
  }

  const disabled = status === "loading" || status === "success";

  return (
    <form
      className="w-full max-w-[440px] space-y-5"
      onSubmit={handleSubmit}
      aria-live="polite"
    >
      {feedback ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="contact-name" className={labelClassName}>
          {t("Full name")}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          placeholder={t("Example Doe")}
          className={inputClassName}
          required
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="contact-email" className={labelClassName}>
          {t("Email address")}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          placeholder={t("example@example.com")}
          className={inputClassName}
          required
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="contact-message" className={labelClassName}>
          {t("Message")}
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          className={textareaClassName}
          required
          disabled={disabled}
        />
      </div>
      {spamProtectionEnabled ? (
        <div className="sr-only" aria-hidden>
          <label htmlFor="website-field">{t("Do not fill out this field")}</label>
          <input
            id="website-field"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
      ) : null}
      <button
        type="submit"
        className={clsx(
          theme.buttonShape,
          "w-fit bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70",
        )}
        disabled={disabled}
      >
        {status === "loading" ? t("Sending...") : t("Send Message")}
      </button>
    </form>
  );
}

type ContactInfoItemProps = {
  icon: (props: IconProps) => JSX.Element;
  label: string;
  children: ReactNode;
};

function ContactInfoItem({ icon: Icon, label, children }: ContactInfoItemProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">
        <Icon className="h-4 w-4 text-[var(--site-accent)]" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

type SocialLinkProps = {
  label: string;
  href: string;
  color: string;
  children: ReactNode;
};

function SocialLink({ label, href, color, children }: SocialLinkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm transition hover:opacity-90 sm:h-9 sm:w-9"
      style={{ backgroundColor: color }}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}

type IconProps = {
  className?: string;
};

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

function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M4.5 12h15M12 4.5c2.2 2.2 2.2 12.8 0 15M12 4.5c-2.2 2.2-2.2 12.8 0 15"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14.5 8.5h2V6h-2c-2.2 0-3.5 1.3-3.5 3.5V12H9v2.5h2v5h2.5v-5h2l0.5-2.5h-2.5V9.7c0-.7.3-1.2 1-1.2z"
        fill="currentColor"
      />
    </svg>
  );
}

function TwitterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M19.5 8.1c.8-.5 1.2-1 1.5-1.7-.7.4-1.4.6-2.2.8a3.6 3.6 0 0 0-6.1 2.5c0 .3 0 .6.1.8-3-.1-5.6-1.6-7.3-3.8a3.6 3.6 0 0 0 1.1 4.8c-.6 0-1.1-.2-1.6-.4v.1c0 1.8 1.3 3.3 3.1 3.6-.3.1-.7.2-1.1.2-.2 0-.5 0-.7-.1.5 1.6 2 2.7 3.8 2.7A7.3 7.3 0 0 1 4 18.1a10.2 10.2 0 0 0 5.6 1.6c6.7 0 10.4-5.6 10.4-10.4v-.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4.5 8.5c0-1.4 1.1-2.5 2.5-2.5h10c1.4 0 2.5 1.1 2.5 2.5v7c0 1.4-1.1 2.5-2.5 2.5H7c-1.4 0-2.5-1.1-2.5-2.5v-7z"
        fill="currentColor"
      />
      <path d="M10 9.5l5 2.5-5 2.5v-5z" fill="#ffffff" />
    </svg>
  );
}

function TelegramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M19.6 5.3 4.8 10.9c-1 .4-1 1.1-.2 1.4l3.8 1.2 1.5 4.3c.2.6.3.8.7.8.4 0 .6-.2 1-.6l2-1.9 4 2.9c.7.4 1.2.2 1.4-.7l2.6-12.1c.2-1-.3-1.4-1-1.1z"
        fill="currentColor"
      />
      <path
        d="M9.7 13.3 16 8.3"
        stroke="#ffffff"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="16.5" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}

function LinkedInIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="5" y="9" width="3" height="10" fill="currentColor" />
      <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
      <path
        d="M11 9h3v1.4c.6-.9 1.6-1.6 3.3-1.6 2.6 0 4.2 1.6 4.2 4.7V19h-3v-5.1c0-1.7-.7-2.6-2.1-2.6-1.2 0-2 .7-2.3 1.7-.1.3-.1.7-.1 1.1V19h-3V9z"
        fill="currentColor"
      />
    </svg>
  );
}

function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 5a6.5 6.5 0 0 0-5.6 9.7L5 19l4.4-1.3A6.5 6.5 0 1 0 12 5z"
        fill="currentColor"
      />
      <path
        d="M9.6 9.2c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.2.3-.7.7-.7 1.7s.8 1.9.9 2.1c.1.2 1.5 2.4 3.7 3.3 1.8.8 2.2.6 2.6.6.4-.1 1.2-.5 1.4-1 .2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.3-.2-.1-1.2-.6-1.4-.7-.2-.1-.4-.1-.5.1-.2.2-.6.7-.7.8-.1.1-.3.2-.5.1-.2-.1-.9-.3-1.7-1-.6-.6-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4.1-.1.2-.3.3-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4 0-.1-.5-1.3-.7-1.7z"
        fill="#ffffff"
      />
    </svg>
  );
}

function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 4.5a7.5 7.5 0 0 0-2.4 14.6c.4.1.6-.2.6-.4v-1.5c-2.5.5-3-1.1-3-1.1-.4-1.1-1-1.4-1-1.4-.8-.5.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.4 2.1 1 2.7.8.1-.6.3-1 .6-1.2-2-.2-4-1-4-4.5 0-1 .4-1.9 1-2.6-.1-.2-.4-1 .1-2.1 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.2 2.6-1 2.6-1 .5 1.1.2 1.9.1 2.1.6.7 1 1.6 1 2.6 0 3.5-2.1 4.3-4.1 4.5.3.3.6.8.6 1.7v2.4c0 .2.2.5.6.4A7.5 7.5 0 0 0 12 4.5z"
        fill="currentColor"
      />
    </svg>
  );
}
