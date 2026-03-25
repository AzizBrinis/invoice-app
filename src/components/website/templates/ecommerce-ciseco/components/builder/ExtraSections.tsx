import clsx from "clsx";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { Section } from "../layout/Section";

type ExtraSectionsProps = {
  theme: ThemeTokens;
  sections: WebsiteBuilderSection[];
  mediaLibrary: WebsiteBuilderMediaAsset[];
};

export function ExtraSections({
  theme,
  sections,
  mediaLibrary,
}: ExtraSectionsProps) {
  if (!sections.length) return null;
  return (
    <>
      {sections.map((section) => {
        const image = resolveBuilderMedia(section.mediaId, mediaLibrary);
        const secondaryImage = resolveBuilderMedia(
          section.secondaryMediaId,
          mediaLibrary,
        );
        return (
          <Section
            key={section.id}
            theme={theme}
            builderSectionId={section.id}
            className="pt-6"
          >
            <div className="space-y-6 rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
              <div className="space-y-2">
                {section.eyebrow ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                    {section.eyebrow}
                  </p>
                ) : null}
                {section.title ? (
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {section.title}
                  </h2>
                ) : null}
                {section.subtitle ? (
                  <p className="text-sm text-slate-600">{section.subtitle}</p>
                ) : null}
                {section.description ? (
                  <p className="text-sm text-slate-500">{section.description}</p>
                ) : null}
              </div>

              {image?.src ? (
                <div className="overflow-hidden rounded-2xl bg-slate-100">
                  <img
                    src={image.src}
                    alt={image.alt || section.title || "Section image"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}

              {secondaryImage?.src ? (
                <div className="overflow-hidden rounded-2xl bg-slate-100">
                  <img
                    src={secondaryImage.src}
                    alt={secondaryImage.alt || section.title || "Section image"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}

              {section.items?.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => {
                    const itemMedia = resolveBuilderMedia(item.mediaId, mediaLibrary);
                    return (
                      <div
                        key={item.id}
                        className="flex h-full flex-col gap-3 rounded-2xl border border-black/5 bg-slate-50 p-4"
                      >
                        {itemMedia?.src ? (
                          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white">
                            <img
                              src={itemMedia.src}
                              alt={itemMedia.alt || item.title || "Item"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : null}
                        <div className="space-y-1">
                          {item.title ? (
                            <p className="text-sm font-semibold text-slate-900">
                              {item.title}
                            </p>
                          ) : null}
                          {item.description ? (
                            <p className="text-xs text-slate-500">
                              {item.description}
                            </p>
                          ) : null}
                          {item.tag ? (
                            <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-600">
                              {item.tag}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {section.buttons?.length ? (
                <div className="flex flex-wrap gap-3">
                  {section.buttons.map((button) => (
                    <a
                      key={button.id}
                      href={button.href ?? "#"}
                      className={clsx(
                        theme.buttonShape,
                        button.style === "primary"
                          ? "bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                          : button.style === "secondary"
                            ? "border border-black/10 bg-white px-5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            : "px-5 py-2 text-xs font-semibold text-slate-700 underline",
                      )}
                    >
                      {button.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </Section>
        );
      })}
    </>
  );
}
