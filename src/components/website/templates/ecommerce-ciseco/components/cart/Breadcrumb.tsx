import { useCisecoI18n } from "../../i18n";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  const { t, localizeHref } = useCisecoI18n();
  return (
    <nav
      aria-label={t("Breadcrumb")}
      className="flex flex-wrap items-center gap-2 text-xs text-slate-500"
    >
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 ? <span className="text-slate-300">/</span> : null}
          {item.href ? (
            <a href={localizeHref(item.href)} className="transition hover:text-slate-900">
              {t(item.label)}
            </a>
          ) : (
            <span className="text-slate-900">{t(item.label)}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
