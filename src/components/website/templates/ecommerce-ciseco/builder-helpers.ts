import {
  resolveCisecoBuilderPageConfig,
  type WebsiteBuilderConfig,
  type WebsiteBuilderMediaAsset,
  type WebsiteBuilderPageConfig,
  type WebsiteBuilderSection,
} from "@/lib/website/builder";

export function resolveCisecoPageConfig(
  builder: WebsiteBuilderConfig | null | undefined,
  pageKey: string,
): WebsiteBuilderPageConfig | null {
  return resolveCisecoBuilderPageConfig(builder, pageKey);
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

export function resolveBuilderSectionBySignature(
  sections: WebsiteBuilderSection[],
  matcher: {
    ids?: string | string[];
    type?: WebsiteBuilderSection["type"];
    layouts?: string | string[];
  },
) {
  const visibleSections = sections.filter(
    (section) => section.visible !== false,
  );
  const ids = matcher.ids
    ? Array.isArray(matcher.ids)
      ? matcher.ids
      : [matcher.ids]
    : [];
  for (const id of ids) {
    const byId = visibleSections.find((section) => section.id === id);
    if (byId) {
      return byId;
    }
  }
  const layouts = matcher.layouts
    ? Array.isArray(matcher.layouts)
      ? matcher.layouts
      : [matcher.layouts]
    : [];
  if (matcher.type && layouts.length) {
    const byLayout = visibleSections.find(
      (section) =>
        section.type === matcher.type &&
        layouts.some((layout) => layout === section.layout),
    );
    if (byLayout) {
      return byLayout;
    }
  }
  if (matcher.type) {
    return (
      visibleSections.find((section) => section.type === matcher.type) ?? null
    );
  }
  return null;
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
