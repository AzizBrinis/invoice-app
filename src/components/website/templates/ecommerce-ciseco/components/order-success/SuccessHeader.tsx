import { useCisecoI18n } from "../../i18n";

type SuccessHeaderProps = {
  eyebrow: string;
  title: string;
  message: string;
};

export function SuccessHeader({ eyebrow, title, message }: SuccessHeaderProps) {
  const { t } = useCisecoI18n();

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
        {t(eyebrow)}
      </p>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          {t(title)}
        </h1>
        <p className="max-w-xl text-sm text-slate-600 sm:text-base">
          {t(message)}
        </p>
      </div>
    </div>
  );
}
