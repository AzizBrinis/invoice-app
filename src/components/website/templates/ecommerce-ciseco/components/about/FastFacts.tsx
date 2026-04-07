import type { ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";

type FastFact = {
  id: string;
  value: string;
  description: string;
};

type FastFactsProps = {
  theme: ThemeTokens;
  title: string;
  description: string;
  facts: FastFact[];
  sectionId?: string;
};

export function FastFacts({
  theme,
  title,
  description,
  facts,
  sectionId,
}: FastFactsProps) {
  const { t } = useCisecoI18n();

  return (
    <Section theme={theme} id="fast-facts" builderSectionId={sectionId}>
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span aria-hidden="true">🚀</span>
            <span>{t(title)}</span>
          </div>
          <p className="text-sm text-slate-600">{t(description)}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <div
              key={fact.id}
              className="rounded-3xl border border-black/5 bg-slate-50 p-6 shadow-sm"
            >
              <p className="text-xl font-semibold text-slate-900">
                {fact.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {t(fact.description)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
