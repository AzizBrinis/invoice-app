import { useCisecoI18n } from "../../i18n";

export function AuthDivider() {
  const { t } = useCisecoI18n();

  return (
    <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
      <span className="h-px flex-1 bg-slate-200" />
      {t("OR")}
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
