import { useCisecoI18n } from "../../i18n";

type AuthPrimaryButtonProps = {
  label: string;
  type?: "button" | "submit";
  disabled?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
};

export function AuthPrimaryButton({
  label,
  type = "button",
  disabled,
  isLoading,
  loadingLabel,
}: AuthPrimaryButtonProps) {
  const { t } = useCisecoI18n();
  const resolvedLabel = isLoading
    ? t(loadingLabel ?? "Loading...")
    : t(label);
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className="w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_16px_30px_rgba(15,23,42,0.25)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {resolvedLabel}
    </button>
  );
}
