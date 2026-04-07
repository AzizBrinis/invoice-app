import { useCisecoI18n } from "../../i18n";

export type SocialProvider = "facebook" | "twitter" | "google";

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  facebook: "Continue with Facebook",
  twitter: "Continue with Twitter",
  google: "Continue with Google",
};

const buttonClassName =
  "group relative flex w-full items-center justify-center rounded-xl bg-[#eff6ff] px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[#e7f2ff] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

type AuthSocialButtonsProps = {
  providers?: SocialProvider[];
  onProviderClick?: (provider: SocialProvider) => void;
  disabled?: boolean;
};

export function AuthSocialButtons({
  providers,
  onProviderClick,
  disabled,
}: AuthSocialButtonsProps) {
  const { t } = useCisecoI18n();

  if (providers && providers.length === 0) {
    return null;
  }
  const resolvedProviders =
    providers && providers.length > 0
      ? providers
      : (Object.keys(PROVIDER_LABELS) as SocialProvider[]);
  return (
    <div className="space-y-3">
      {resolvedProviders.map((provider) => (
        <button
          key={provider}
          type="button"
          className={buttonClassName}
          disabled={disabled}
          onClick={() => onProviderClick?.(provider)}
        >
          <span className="absolute left-4 flex h-5 w-5 items-center justify-center transition-transform duration-200 group-hover:scale-105">
            <SocialIcon provider={provider} />
          </span>
          {t(PROVIDER_LABELS[provider])}
        </button>
      ))}
    </div>
  );
}

function SocialIcon({ provider }: { provider: SocialProvider }) {
  if (provider === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="#1877F2" />
        <path
          d="M14.5 8.5h-1.6c-.5 0-.9.4-.9.9V11h2.4l-.4 2.3H12v5.2h-2.4v-5.2H8V11h1.6V9.2C9.6 7.7 10.7 6.8 12 6.8h2.5v1.7z"
          fill="#ffffff"
        />
      </svg>
    );
  }
  if (provider === "twitter") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M19.9 7.4c-.6.3-1.3.5-2 .6.7-.4 1.2-1.1 1.4-1.9-.7.4-1.4.7-2.2.8A3.2 3.2 0 0 0 11.6 9c0 .3 0 .6.1.8-2.6-.1-4.8-1.4-6.3-3.4-.3.5-.4 1-.4 1.6 0 1.1.6 2.1 1.5 2.7-.5 0-1-.2-1.5-.4v.1c0 1.6 1.1 2.9 2.6 3.2-.3.1-.6.1-1 .1-.2 0-.5 0-.7-.1.5 1.4 1.8 2.4 3.4 2.4A6.5 6.5 0 0 1 5 17.5c-.4 0-.7 0-1-.1a9.2 9.2 0 0 0 5 1.5c6 0 9.3-5 9.3-9.3v-.4c.6-.5 1.2-1.1 1.6-1.8z"
          fill="#0f172a"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M21.6 12.3c0-.7-.1-1.3-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.1 3-7.3z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 5-1 6.7-2.6l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.7A10 10 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.2 13.5a6 6 0 0 1-.3-1.9c0-.7.1-1.3.3-1.9V7H2.9A10 10 0 0 0 2 11.6c0 1.6.4 3.1 1 4.4l3.2-2.5z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.7c1.5 0 2.9.5 3.9 1.5l3-3A9.9 9.9 0 0 0 12 2a10 10 0 0 0-9.1 5l3.2 2.7C7 7.5 9.3 5.7 12 5.7z"
        fill="#EA4335"
      />
    </svg>
  );
}
