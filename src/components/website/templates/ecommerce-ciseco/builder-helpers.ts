import {
  ensureCisecoPageConfigs,
  type WebsiteBuilderConfig,
  type WebsiteBuilderMediaAsset,
  type WebsiteBuilderPageConfig,
  type WebsiteBuilderSection,
} from "@/lib/website/builder";

export function resolveCisecoPageConfig(
  builder: WebsiteBuilderConfig | null | undefined,
  pageKey: string,
): WebsiteBuilderPageConfig | null {
  if (!builder) return null;

  // Normalize legacy configs that only stored sections (no per-page state).
  const normalized = ensureCisecoPageConfigs(builder);
  const pages = normalized.pages ?? {};

  if (pages[pageKey]) {
    return pages[pageKey] ?? null;
  }

  // Fallback to home or the first available page so the template never drops back
  // to hardcoded defaults when the requested key is missing.
  const fallbackPage = pages.home ?? Object.values(pages)[0];
  if (fallbackPage) {
    return fallbackPage;
  }

  // Last resort: return a minimal config built from the legacy fields so that
  // the UI remains usable even if pages could not be resolved.
  return {
    sections: normalized.sections ?? [],
    mediaLibrary: normalized.mediaLibrary ?? [],
    seo: {},
  };
}

export function resolveBuilderMedia(
  mediaId: string | null | undefined,
  mediaLibrary: WebsiteBuilderMediaAsset[],
) {
  if (!mediaId) return null;
  return mediaLibrary.find((asset) => asset.id === mediaId) ?? null;
}

export function resolveBuilderSection(
  sections: WebsiteBuilderSection[],
  type: WebsiteBuilderSection["type"],
  layout?: string | string[],
) {
  const visibleSections = sections.filter(
    (section) => section.visible !== false,
  );
  if (!layout) {
    return visibleSections.find((section) => section.type === type) ?? null;
  }
  const layouts = Array.isArray(layout) ? layout : [layout];
  return (
    visibleSections.find(
      (section) =>
        section.type === type &&
        layouts.some((entry) => entry === section.layout),
    ) ?? null
  );
}

export function resolveVisibleSections(sections: WebsiteBuilderSection[]) {
  return sections.filter((section) => section.visible !== false);
}

export function buildImageList(
  items: WebsiteBuilderSection["items"],
  mediaLibrary: WebsiteBuilderMediaAsset[],
  options: { fallback: readonly string[]; altPrefix: string },
) {
  return items
    .map((item, index) => {
      const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
      const src = asset?.src ?? options.fallback[index % options.fallback.length];
      if (!src) return null;
      return {
        src,
        alt: asset?.alt || item.title || `${options.altPrefix} ${index + 1}`,
      };
    })
    .filter((item): item is { src: string; alt: string } => Boolean(item));
}
