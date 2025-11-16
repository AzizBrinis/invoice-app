export const WEBSITE_MEDIA_PLACEHOLDERS = {
  hero: "/images/placeholders/hero-collage.svg",
  about: "/images/placeholders/workspace-grid.svg",
  gallery: [
    "/images/placeholders/gallery-aurora.svg",
    "/images/placeholders/gallery-nova.svg",
    "/images/placeholders/gallery-atlas.svg",
  ],
  team: [
    "/images/placeholders/portrait-1.svg",
    "/images/placeholders/portrait-2.svg",
    "/images/placeholders/portrait-3.svg",
  ],
  logos: [
    "/images/placeholders/logo-aurora.svg",
    "/images/placeholders/logo-orbit.svg",
    "/images/placeholders/logo-kosmos.svg",
    "/images/placeholders/logo-loop.svg",
  ],
} as const;

export type WebsiteMediaPlaceholderKey = keyof typeof WEBSITE_MEDIA_PLACEHOLDERS;
