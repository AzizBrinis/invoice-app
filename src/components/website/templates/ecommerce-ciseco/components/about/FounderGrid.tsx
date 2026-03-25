import type { ThemeTokens } from "../../types";
import { Section } from "../layout/Section";

type Founder = {
  id: string;
  name: string;
  role: string;
  description?: string | null;
  image?: {
    src: string;
    alt: string;
  } | null;
};

type FounderGridProps = {
  theme: ThemeTokens;
  title: string;
  description: string;
  founders: Founder[];
  sectionId?: string;
};

export function FounderGrid({
  theme,
  title,
  description,
  founders,
  sectionId,
}: FounderGridProps) {
  return (
    <Section theme={theme} id="founder" builderSectionId={sectionId}>
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span aria-hidden="true">☂</span>
            <span>{title}</span>
          </div>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {founders.map((founder) => (
            <div key={founder.id} className="space-y-3">
              <div className="group overflow-hidden rounded-3xl bg-slate-100 shadow-sm">
                <div className="aspect-[4/5]">
                  {founder.image ? (
                    <img
                      src={founder.image.src}
                      alt={founder.image.alt}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : null}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {founder.name}
                </p>
                {founder.role ? (
                  <p className="text-xs text-slate-500">{founder.role}</p>
                ) : null}
                {founder.description ? (
                  <p className="text-[11px] text-slate-400">
                    {founder.description}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
