"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CatalogPage } from "@/components/website/catalog-page";
import NextImage from "next/image";
import type { CatalogPayload, SignupSettingsInput } from "@/server/website";
import {
  CONTACT_SOCIAL_ICON_OPTIONS,
  type ContactSocialLink,
} from "@/lib/website/contact";
import type {
  WebsiteBuilderConfig,
  WebsiteBuilderPageConfig,
  WebsiteBuilderSection,
  WebsiteBuilderMediaAsset,
  WebsiteBuilderButton,
} from "@/lib/website/builder";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import { CISECO_PAGE_DEFINITIONS, type CisecoPageKey } from "@/lib/website/ciseco-pages";
import {
  BUILDER_SECTION_TYPES,
  BUILDER_SECTION_LAYOUTS,
  TECH_AGENCY_SECTION_LAYOUT_PRESETS,
  BUILDER_SECTION_BUTTON_LIMIT,
  builderConfigSchema,
  sanitizeBuilderPages,
  createSectionTemplate,
} from "@/lib/website/builder";
import { generateId } from "@/lib/id";
import { slugify } from "@/lib/slug";
import {
  persistBuilderConfigAction,
  persistContactPageAction,
  persistSignupSettingsAction,
} from "@/app/(app)/site-web/personnalisation-avancee/actions";
import type { WebsiteBuilderState } from "@/server/website";

type AdvancedCustomizationClientProps = {
  builder: WebsiteBuilderState;
  links: {
    previewUrl: string;
    slugPreviewUrl: string;
  };
  website: {
    slug: string;
    accentColor: string;
    published: boolean;
  };
  signupSettings: SignupSettingsInput;
  catalog: CatalogPayload;
};

type Device = "desktop" | "tablet" | "mobile";

type ContactSettings = {
  intro: string;
  email: string;
  phone: string;
  address: string;
  socialLinks: ContactSocialLink[];
};

type SignupProviderKey = keyof SignupSettingsInput["providers"];

type SignupProviderSettings =
  SignupSettingsInput["providers"][SignupProviderKey];

const DEFAULT_SIGNUP_PROVIDER: SignupSettingsInput["providers"]["facebook"] = {
  enabled: false,
  useEnv: true,
  clientId: null,
  clientSecret: null,
};

const SIGNUP_PROVIDERS: Array<{
  id: SignupProviderKey;
  label: string;
  description: string;
}> = [
  {
    id: "google",
    label: "Google",
    description: "Connexion rapide avec Google.",
  },
  {
    id: "facebook",
    label: "Facebook",
    description: "Connexion rapide avec Facebook.",
  },
  {
    id: "twitter",
    label: "Twitter",
    description: "Connexion rapide avec Twitter (X).",
  },
];

const animationOptions = [
  { label: "Discret", value: "none" },
  { label: "Fondu", value: "fade" },
  { label: "Glissé", value: "slide" },
  { label: "Zoom", value: "zoom" },
];

type SectionMediaField = {
  key: "mediaId" | "secondaryMediaId";
  label: string;
  description?: string;
  placeholder?: string;
};

const SECTION_MEDIA_FIELDS: Partial<Record<WebsiteBuilderSection["type"], SectionMediaField[]>> = {
  hero: [
    {
      key: "mediaId",
      label: "Visuel du héro",
      description: "Image large affichée dans le bloc principal.",
      placeholder: WEBSITE_MEDIA_PLACEHOLDERS.hero,
    },
  ],
  categories: [
    {
      key: "mediaId",
      label: "Illustration de catégorie",
      description: "Image affichée sur la carte.",
      placeholder: WEBSITE_MEDIA_PLACEHOLDERS.categories[0],
    },
  ],
  products: [
    {
      key: "mediaId",
      label: "Visuel produit",
      description: "Image principale de la carte produit.",
      placeholder: WEBSITE_MEDIA_PLACEHOLDERS.products[0],
    },
  ],
  promo: [
    {
      key: "mediaId",
      label: "Visuel promotionnel",
      description: "Image ou texture pour le bandeau promo.",
      placeholder: WEBSITE_MEDIA_PLACEHOLDERS.promos[0],
    },
  ],
  about: [
    {
      key: "mediaId",
      label: "Photo / workspace",
      description: "Illustration visible dans la section À propos.",
      placeholder: WEBSITE_MEDIA_PLACEHOLDERS.about,
    },
  ],
};

const SECTION_ITEM_PLACEHOLDERS: Partial<Record<WebsiteBuilderSection["type"], readonly string[]>> = {
  gallery: WEBSITE_MEDIA_PLACEHOLDERS.gallery,
  categories: WEBSITE_MEDIA_PLACEHOLDERS.categories,
  products: WEBSITE_MEDIA_PLACEHOLDERS.products,
  promo: WEBSITE_MEDIA_PLACEHOLDERS.promos,
  team: WEBSITE_MEDIA_PLACEHOLDERS.team,
  logos: WEBSITE_MEDIA_PLACEHOLDERS.logos,
};

const CISECO_SECTION_LAYOUT_PRESETS: Partial<
  Record<WebsiteBuilderSection["type"], string[]>
> = {
  hero: ["home-hero", "page-hero", "split", "center", "image-right"],
  services: ["discovery", "features", "grid", "list", "stack"],
  products: [
    "new-arrivals",
    "best-sellers",
    "featured",
    "favorites",
    "related",
    "product-options",
    "product-related",
    "collection-grid",
    "grid",
    "list",
    "carousel",
  ],
  promo: ["home-promo", "kids-banner", "banner", "split"],
  categories: ["explore", "grid", "cards", "carousel"],
  gallery: ["departments", "blog-mini", "product-gallery", "grid", "masonry"],
  content: [
    "home-blog",
    "blog-featured",
    "blog-latest",
    "blog-body",
    "blog-related",
    "product-description",
    "stack",
    "split",
  ],
  testimonials: ["home-testimonials", "product-reviews", "grid", "carousel"],
};

function getSectionItemPlaceholder(
  type: WebsiteBuilderSection["type"],
  index: number,
) {
  const placeholders = SECTION_ITEM_PLACEHOLDERS[type];
  if (!placeholders?.length) {
    return null;
  }
  return placeholders[index % placeholders.length];
}

type MediaPlaceholderPickerProps = {
  label: string;
  description?: string;
  value: string | null | undefined;
  assets: WebsiteBuilderMediaAsset[];
  fallbackImage?: string | null;
  onChange: (id: string | null) => void;
  onUpload?: (files: FileList | null) => void;
};

function MediaPlaceholderPicker({
  label,
  description,
  value,
  assets,
  fallbackImage,
  onChange,
  onUpload,
}: MediaPlaceholderPickerProps) {
  const selectedAsset = assets.find((asset) => asset.id === value) ?? null;
  const previewSrc = selectedAsset?.src ?? fallbackImage ?? null;
  const previewAlt = selectedAsset?.alt ?? label;
  const unoptimized = Boolean(selectedAsset?.src?.startsWith("data:"));

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
        {description ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          {previewSrc ? (
            <NextImage
              src={previewSrc}
              alt={previewAlt}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized={unoptimized}
            />
          ) : (
            <span className="block text-center text-[11px] text-zinc-400 dark:text-zinc-500">
              Aucun visuel
            </span>
          )}
        </div>
        <div className="flex-1 space-y-2 text-xs">
          <select
            className="input"
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value || null)}
          >
            <option value="">Utiliser le placeholder</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.alt || asset.id}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer text-[11px] font-semibold text-[var(--site-accent)]">
              Importer
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const files = event.target.files;
                  if (files?.length) {
                    onUpload?.(files);
                    event.target.value = "";
                  }
                }}
              />
            </label>
            {value ? (
              <button
                type="button"
                className="text-[11px] text-red-500"
                onClick={() => onChange(null)}
              >
                Effacer
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function serializeConfig(config: WebsiteBuilderConfig) {
  const clone = structuredClone(config);
  delete clone.updatedAt;
  return JSON.stringify(clone);
}

function serializeContactSettings(settings: ContactSettings) {
  return JSON.stringify(settings);
}

function normalizeSignupSettings(
  input: SignupSettingsInput | null | undefined,
): SignupSettingsInput {
  return {
    redirectTarget: input?.redirectTarget ?? "home",
    providers: {
      facebook: {
        ...DEFAULT_SIGNUP_PROVIDER,
        ...(input?.providers?.facebook ?? {}),
      },
      google: {
        ...DEFAULT_SIGNUP_PROVIDER,
        ...(input?.providers?.google ?? {}),
      },
      twitter: {
        ...DEFAULT_SIGNUP_PROVIDER,
        ...(input?.providers?.twitter ?? {}),
      },
    },
  };
}

function serializeSignupSettings(settings: SignupSettingsInput) {
  return JSON.stringify(settings);
}

const DEFAULT_CISECO_PAGE_KEY: CisecoPageKey = "home";

function resolvePageConfig(
  config: WebsiteBuilderConfig,
  pageKey: CisecoPageKey,
): WebsiteBuilderPageConfig {
  const entry = config.pages?.[pageKey];
  if (entry && typeof entry === "object" && "sections" in entry) {
    return entry as WebsiteBuilderPageConfig;
  }
  return {
    sections: [],
    mediaLibrary: [],
    seo: {},
  };
}

function resolveCisecoPreviewPath(
  pageKey: CisecoPageKey,
  catalog: CatalogPayload,
) {
  const definition = CISECO_PAGE_DEFINITIONS.find(
    (entry) => entry.key === pageKey,
  );
  if (!definition) return "/";
  if (pageKey === "product") {
    const firstProduct = catalog.products.all?.[0];
    if (firstProduct) {
      const fallbackSlug =
        firstProduct.publicSlug?.trim() ||
        slugify(firstProduct.sku || firstProduct.name || firstProduct.id) ||
        firstProduct.id.slice(0, 8);
      if (fallbackSlug) {
        return `/produit/${fallbackSlug}`;
      }
    }
  }
  return definition.path;
}

async function optimizeImage(file: File): Promise<WebsiteBuilderMediaAsset> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = new Image();
  const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger l’image."));
    image.src = dataUrl;
  });
  const maxSize = 1600;
  const ratio = Math.min(1, maxSize / Math.max(loaded.width, loaded.height));
  const width = Math.round(loaded.width * ratio);
  const height = Math.round(loaded.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return {
      id: generateId("asset"),
      kind: "image",
      src: dataUrl,
      alt: file.name,
      width: loaded.width,
      height: loaded.height,
      aspectRatio: loaded.width / loaded.height,
      createdAt: new Date().toISOString(),
      metadata: { context: "upload" },
    };
  }
  context.drawImage(loaded, 0, 0, width, height);
  const optimized = canvas.toDataURL("image/webp", 0.82);
  return {
    id: generateId("asset"),
    kind: "image",
    src: optimized,
    alt: file.name,
    width,
    height,
    aspectRatio: width / height,
    createdAt: new Date().toISOString(),
    metadata: { context: "upload" },
  };
}

export function AdvancedCustomizationClient({
  builder,
  links,
  signupSettings: initialSignupSettings,
  catalog,
}: AdvancedCustomizationClientProps) {
  const [config, setConfig] = useState<WebsiteBuilderConfig>(() => ({
    ...builder.config,
    pages: sanitizeBuilderPages(builder.config.pages),
  }));
  const [history, setHistory] = useState(builder.history);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(() => {
    const pageConfig = resolvePageConfig(builder.config, DEFAULT_CISECO_PAGE_KEY);
    return pageConfig.sections[0]?.id ?? builder.config.sections[0]?.id ?? "";
  });
  const [selectedPageKey, setSelectedPageKey] = useState<CisecoPageKey>(
    DEFAULT_CISECO_PAGE_KEY,
  );
  const [builderStatus, setBuilderStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSettings, setContactSettings] = useState<ContactSettings>(() => ({
    intro: catalog.website.contactBlurb ?? "",
    email: catalog.website.contact.email ?? "",
    phone: catalog.website.contact.phone ?? "",
    address: catalog.website.contact.address ?? "",
    socialLinks: catalog.website.socialLinks ?? [],
  }));
  const [signupStatus, setSignupStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSettings, setSignupSettings] = useState<SignupSettingsInput>(() =>
    normalizeSignupSettings(initialSignupSettings),
  );
  const [device, setDevice] = useState<Device>("desktop");
  const serializedRef = useRef(serializeConfig(builder.config));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactSerializedRef = useRef(
    serializeContactSettings({
      intro: catalog.website.contactBlurb ?? "",
      email: catalog.website.contact.email ?? "",
      phone: catalog.website.contact.phone ?? "",
      address: catalog.website.contact.address ?? "",
      socialLinks: catalog.website.socialLinks ?? [],
    }),
  );
  const contactDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signupSerializedRef = useRef(
    serializeSignupSettings(normalizeSignupSettings(initialSignupSettings)),
  );
  const signupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [, startTransition] = useTransition();
  const isTechAgencyTemplate = catalog.website.templateKey === "ecommerce-tech-agency";
  const isCisecoTemplate = catalog.website.templateKey === "ecommerce-ciseco-home";
  const activePageConfig = isCisecoTemplate
    ? resolvePageConfig(config, selectedPageKey)
    : {
        sections: config.sections,
        mediaLibrary: config.mediaLibrary ?? [],
        seo: {},
      };
  const mediaAssets = activePageConfig.mediaLibrary ?? [];
  const previewPath = isCisecoTemplate
    ? resolveCisecoPreviewPath(selectedPageKey, catalog)
    : null;
  const previewHref = isCisecoTemplate && previewPath
    ? `${links.previewUrl}?path=${encodeURIComponent(previewPath)}`
    : links.previewUrl;
  const overallStatus =
    builderStatus === "error" ||
    contactStatus === "error" ||
    signupStatus === "error"
      ? "error"
      : builderStatus === "saving" ||
          contactStatus === "saving" ||
          signupStatus === "saving"
        ? "saving"
        : "saved";
  const combinedError = builderError ?? contactError ?? signupError;

  const markBuilderDirty = () => {
    setBuilderStatus("saving");
    setBuilderError(null);
  };

  const markContactDirty = () => {
    setContactStatus("saving");
    setContactError(null);
  };

  const markSignupDirty = () => {
    setSignupStatus("saving");
    setSignupError(null);
  };

  useEffect(() => {
    const serialized = serializeConfig(config);
    if (serialized === serializedRef.current) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const normalizedConfig = {
            ...config,
            pages: sanitizeBuilderPages(config.pages),
          };
          builderConfigSchema.parse(normalizedConfig);
          const result = await persistBuilderConfigAction(normalizedConfig);
          serializedRef.current = serializeConfig(result.config);
          setConfig(result.config);
          setHistory(result.history);
          setBuilderStatus("saved");
        } catch (submissionError) {
          setBuilderStatus("error");
          setBuilderError(
            submissionError instanceof Error
              ? submissionError.message
              : "Impossible d’enregistrer la personnalisation.",
          );
        }
      });
    }, 900);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [config, startTransition]);

  useEffect(() => {
    const serialized = serializeContactSettings(contactSettings);
    if (serialized === contactSerializedRef.current) {
      return;
    }
    if (contactDebounceRef.current) {
      clearTimeout(contactDebounceRef.current);
    }
    contactDebounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await persistContactPageAction({
            intro: contactSettings.intro,
            email: contactSettings.email,
            phone: contactSettings.phone,
            address: contactSettings.address,
            socialLinks: contactSettings.socialLinks,
          });
          contactSerializedRef.current = serializeContactSettings(result);
          setContactSettings(result);
          setContactStatus("saved");
        } catch (submissionError) {
          setContactStatus("error");
          setContactError(
            submissionError instanceof Error
              ? submissionError.message
              : "Impossible d’enregistrer la page contact.",
          );
        }
      });
    }, 900);
    return () => {
      if (contactDebounceRef.current) {
        clearTimeout(contactDebounceRef.current);
      }
    };
  }, [contactSettings, startTransition]);

  useEffect(() => {
    const serialized = serializeSignupSettings(signupSettings);
    if (serialized === signupSerializedRef.current) {
      return;
    }
    if (signupDebounceRef.current) {
      clearTimeout(signupDebounceRef.current);
    }
    signupDebounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const trimmedProviders = {
            facebook: {
              ...signupSettings.providers.facebook,
              clientId: signupSettings.providers.facebook.clientId?.trim() || null,
              clientSecret:
                signupSettings.providers.facebook.clientSecret?.trim() || null,
            },
            google: {
              ...signupSettings.providers.google,
              clientId: signupSettings.providers.google.clientId?.trim() || null,
              clientSecret:
                signupSettings.providers.google.clientSecret?.trim() || null,
            },
            twitter: {
              ...signupSettings.providers.twitter,
              clientId: signupSettings.providers.twitter.clientId?.trim() || null,
              clientSecret:
                signupSettings.providers.twitter.clientSecret?.trim() || null,
            },
          } satisfies Parameters<
            typeof persistSignupSettingsAction
          >[0]["providers"];
          const nextSettings = {
            ...signupSettings,
            providers: trimmedProviders,
          } satisfies Parameters<typeof persistSignupSettingsAction>[0];
          await persistSignupSettingsAction(nextSettings);
          signupSerializedRef.current = serializeSignupSettings(nextSettings);
          setSignupSettings(nextSettings);
          setSignupStatus("saved");
        } catch (submissionError) {
          setSignupStatus("error");
          setSignupError(
            submissionError instanceof Error
              ? submissionError.message
              : "Impossible d’enregistrer la configuration d’inscription.",
          );
        }
      });
    }, 900);
    return () => {
      if (signupDebounceRef.current) {
        clearTimeout(signupDebounceRef.current);
      }
    };
  }, [signupSettings, startTransition]);

  const previewBuilderConfig = useMemo(() => {
    if (!isCisecoTemplate) {
      return {
        ...config,
        sections: config.sections.filter((section) => section.visible !== false),
      };
    }
    const pageConfig = resolvePageConfig(config, selectedPageKey);
    const filteredSections = pageConfig.sections.filter(
      (section) => section.visible !== false,
    );
    return {
      ...config,
      pages: {
        ...config.pages,
        [selectedPageKey]: {
          ...pageConfig,
          sections: filteredSections,
        },
      },
    };
  }, [config, isCisecoTemplate, selectedPageKey]);

  const previewPayload = useMemo(() => {
    return {
      ...catalog,
      website: {
        ...catalog.website,
        accentColor: previewBuilderConfig.theme?.accent ?? catalog.website.accentColor,
        builder: previewBuilderConfig,
        contactBlurb: contactSettings.intro || null,
        socialLinks: contactSettings.socialLinks,
        ecommerceSettings: {
          ...catalog.website.ecommerceSettings,
          signup: signupSettings,
        },
        contact: {
          ...catalog.website.contact,
          email: contactSettings.email || null,
          phone: contactSettings.phone || null,
          address: contactSettings.address || null,
        },
      },
    };
  }, [catalog, previewBuilderConfig, contactSettings, signupSettings]);

  const visibleSectionIndex = useMemo(() => {
    const ids = (isCisecoTemplate
      ? previewBuilderConfig.pages?.[selectedPageKey]?.sections ?? []
      : previewBuilderConfig.sections
    ).map((section) => section.id);
    return `|${ids.join("|")}|`;
  }, [isCisecoTemplate, previewBuilderConfig.pages, previewBuilderConfig.sections, selectedPageKey]);

  useEffect(() => {
    if (!previewRef.current || !selectedSectionId) return;
    const visibleSectionExists = visibleSectionIndex.includes(`|${selectedSectionId}|`);
    if (!visibleSectionExists) {
      previewRef.current.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    requestAnimationFrame(() => {
      const target = previewRef.current?.querySelector<HTMLElement>(
        `[data-builder-section="${selectedSectionId}"]`,
      );
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }, [visibleSectionIndex, selectedSectionId]);

  useEffect(() => {
    if (!isCisecoTemplate) return;
    const pageConfig = resolvePageConfig(config, selectedPageKey);
    const exists = pageConfig.sections.some(
      (section) => section.id === selectedSectionId,
    );
    if (!exists) {
      setSelectedSectionId(pageConfig.sections[0]?.id ?? "");
    }
  }, [config, isCisecoTemplate, selectedPageKey, selectedSectionId]);

  const selectedSection =
    activePageConfig.sections.find((section) => section.id === selectedSectionId) ??
    activePageConfig.sections[0] ??
    null;
  const sectionMediaFields = selectedSection
    ? SECTION_MEDIA_FIELDS[selectedSection.type] ?? []
    : [];
  const layoutOptions = selectedSection
    ? (isTechAgencyTemplate
        ? TECH_AGENCY_SECTION_LAYOUT_PRESETS[selectedSection.type]
        : isCisecoTemplate
          ? CISECO_SECTION_LAYOUT_PRESETS[selectedSection.type]
          : undefined) ??
      BUILDER_SECTION_LAYOUTS[selectedSection.type] ??
      []
    : [];
  const resolvedLayoutOptions =
    selectedSection?.layout && !layoutOptions.includes(selectedSection.layout)
      ? [...layoutOptions, selectedSection.layout]
      : layoutOptions;

  function updateSection(
    sectionId: string,
    updater: (section: WebsiteBuilderSection) => Partial<WebsiteBuilderSection>,
  ) {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updater(section) } : section,
      ),
    }));
  }

  function updateItem(
    sectionId: string,
    itemId: string,
    changes: Partial<WebsiteBuilderSection["items"][number]>,
  ) {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items?.map((item) =>
                item.id === itemId ? { ...item, ...changes } : item,
              ),
            }
          : section,
      ),
    }));
  }

  function updateButton(
    sectionId: string,
    buttonId: string,
    changes: Partial<WebsiteBuilderButton>,
  ) {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              buttons: section.buttons?.map((button) =>
                button.id === buttonId ? { ...button, ...changes } : button,
              ),
            }
          : section,
      ),
    }));
  }

  function updateContactField<Key extends keyof ContactSettings>(
    key: Key,
    value: ContactSettings[Key],
  ) {
    markContactDirty();
    setContactSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateSocialLink(id: string, changes: Partial<ContactSocialLink>) {
    markContactDirty();
    setContactSettings((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link) =>
        link.id === id ? { ...link, ...changes } : link,
      ),
    }));
  }

  function addSocialLink() {
    const fallback = CONTACT_SOCIAL_ICON_OPTIONS[0];
    if (!fallback) return;
    markContactDirty();
    setContactSettings((prev) => ({
      ...prev,
      socialLinks: [
        ...prev.socialLinks,
        {
          id: generateId("social"),
          label: fallback.label,
          href: "",
          icon: fallback.value,
        },
      ],
    }));
  }

  function removeSocialLink(id: string) {
    markContactDirty();
    setContactSettings((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((link) => link.id !== id),
    }));
  }

  function updateSignupRedirectTarget(
    value: SignupSettingsInput["redirectTarget"],
  ) {
    markSignupDirty();
    setSignupSettings((prev) => ({
      ...prev,
      redirectTarget: value,
    }));
  }

  function updateSignupProvider(
    providerId: SignupProviderKey,
    changes: Partial<SignupProviderSettings>,
  ) {
    markSignupDirty();
    setSignupSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          ...changes,
        },
      },
    }));
  }

  function addSection(type: WebsiteBuilderSection["type"]) {
    const template = createSectionTemplate(type);
    const layoutPreset = isTechAgencyTemplate
      ? TECH_AGENCY_SECTION_LAYOUT_PRESETS[type]?.[0]
      : undefined;
    const nextTemplate = layoutPreset
      ? { ...template, layout: layoutPreset }
      : template;
    updateActivePage((page) => ({
      ...page,
      sections: [...page.sections, nextTemplate],
    }));
    setSelectedSectionId(nextTemplate.id);
  }

  function removeSection(sectionId: string) {
    updateActivePage((page) => ({
      ...page,
      sections: page.sections.filter((section) => section.id !== sectionId),
    }));
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(
        activePageConfig.sections.filter((section) => section.id !== sectionId)[0]?.id ??
          "",
      );
    }
  }

  function duplicateSection(sectionId: string) {
    const target = activePageConfig.sections.find((section) => section.id === sectionId);
    if (!target) return;
    const clone = {
      ...target,
      id: generateId(target.type),
      items: target.items?.map((item) => ({ ...item, id: generateId("item") })) ?? [],
      buttons:
        target.buttons?.map((button) => ({ ...button, id: generateId("btn") })) ?? [],
    };
    updateActivePage((page) => ({
      ...page,
      sections: [...page.sections, clone],
    }));
    setSelectedSectionId(clone.id);
  }

  function restoreFromSnapshot(snapshot: WebsiteBuilderConfig) {
    markBuilderDirty();
    const normalizedSnapshot = {
      ...snapshot,
      pages: sanitizeBuilderPages(snapshot.pages),
    };
    setConfig(normalizedSnapshot);
    if (isCisecoTemplate) {
      const pageConfig = resolvePageConfig(normalizedSnapshot, selectedPageKey);
      setSelectedSectionId(pageConfig.sections[0]?.id ?? "");
    } else {
      setSelectedSectionId(normalizedSnapshot.sections[0]?.id ?? "");
    }
  }

  function reorderSections(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const next = [...activePageConfig.sections];
    const sourceIndex = next.findIndex((section) => section.id === sourceId);
    const targetIndex = next.findIndex((section) => section.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [removed] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, removed);
    updateActivePage((page) => ({
      ...page,
      sections: next,
    }));
  }

  async function handleMediaUpload(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const uploads: WebsiteBuilderMediaAsset[] = [];
    for (const file of Array.from(fileList)) {
      const processed = await optimizeImage(file);
      uploads.push(processed);
    }
    updateActivePage((page) => ({
      ...page,
      mediaLibrary: [...(page.mediaLibrary ?? []), ...uploads],
    }));
  }

  function updateActivePage(
    updater: (page: WebsiteBuilderPageConfig) => WebsiteBuilderPageConfig,
  ) {
    markBuilderDirty();
    setConfig((prev) => {
      if (!isCisecoTemplate) {
        const nextPage = updater({
          sections: prev.sections,
          mediaLibrary: prev.mediaLibrary ?? [],
          seo: {},
        });
        return {
          ...prev,
          sections: nextPage.sections,
          mediaLibrary: nextPage.mediaLibrary,
        };
      }
      const currentPage = resolvePageConfig(prev, selectedPageKey);
      const nextPage = updater(currentPage);
      return {
        ...prev,
        pages: {
          ...prev.pages,
          [selectedPageKey]: nextPage,
        },
      };
    });
  }

  function updatePageSeo(
    changes: Partial<WebsiteBuilderPageConfig["seo"]>,
  ) {
    updateActivePage((page) => ({
      ...page,
      seo: {
        ...page.seo,
        ...changes,
      },
    }));
  }

  function updateTheme(partial: Partial<WebsiteBuilderConfig["theme"]>) {
    markBuilderDirty();
    setConfig((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        ...partial,
      },
    }));
  }

  function updateMediaAsset(assetId: string, changes: Partial<WebsiteBuilderMediaAsset>) {
    updateActivePage((page) => ({
      ...page,
      mediaLibrary: (page.mediaLibrary ?? []).map((asset) =>
        asset.id === assetId ? { ...asset, ...changes } : asset,
      ),
    }));
  }

  function removeMediaAsset(assetId: string) {
    updateActivePage((page) => ({
      ...page,
      mediaLibrary: (page.mediaLibrary ?? []).filter(
        (asset) => asset.id !== assetId,
      ),
      sections: page.sections.map((section) => ({
        ...section,
        mediaId: section.mediaId === assetId ? null : section.mediaId,
        secondaryMediaId:
          section.secondaryMediaId === assetId ? null : section.secondaryMediaId,
        items: section.items?.map((item) => ({
          ...item,
          mediaId: item.mediaId === assetId ? null : item.mediaId,
        })),
      })),
    }));
  }

  const devicePreviewClass: Record<Device, string> = {
    desktop: "max-w-full",
    tablet: "mx-auto max-w-[900px]",
    mobile: "mx-auto max-w-[420px]",
  };
  const deviceFramePadding: Record<Device, string> = {
    desktop: "p-4",
    tablet: "px-6 py-8",
    mobile: "px-5 py-10",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Personnalisation avancée
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Structurez vos sections, vos visuels et l’identité visuelle sans écrire de code.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1",
              overallStatus === "saving"
                ? "border-amber-300 text-amber-600"
                : overallStatus === "error"
                  ? "border-red-400 text-red-500"
                  : "border-emerald-300 text-emerald-600",
            )}
          >
            {overallStatus === "saving"
              ? "Enregistrement…"
              : overallStatus === "error"
                ? "Erreur d’enregistrement"
                : "Sauvegardé"}
          </span>
          <Button asChild variant="secondary" className="px-3 py-1.5 text-xs">
            <a href={previewHref} target="_blank" rel="noreferrer">
              Ouvrir la prévisualisation
            </a>
          </Button>
        </div>
      </div>

      {combinedError ? (
        <Alert variant="error" title={combinedError} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          {isCisecoTemplate ? (
            <div className="card space-y-4 p-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Page
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Sélectionnez la page à personnaliser.
                </p>
              </div>
              <select
                className="input text-sm"
                value={selectedPageKey}
                onChange={(event) =>
                  setSelectedPageKey(event.target.value as CisecoPageKey)
                }
              >
                {CISECO_PAGE_DEFINITIONS.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="card space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Sections
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Glissez pour réordonner. Ajoutez ou masquez les sections.
                </p>
              </div>
              <select
                className="input text-xs"
                onChange={(event) => {
                  const type = event.target.value as WebsiteBuilderSection["type"];
                  if (!type) return;
                  addSection(type);
                  event.currentTarget.value = "";
                }}
                defaultValue=""
              >
                <option value="">Ajouter…</option>
                {BUILDER_SECTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {friendlySectionLabels[type] ?? type}
                  </option>
                ))}
              </select>
            </div>
            <ol className="space-y-2 text-sm">
              {activePageConfig.sections.map((section) => (
                <li
                  key={section.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", section.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    const sourceId = event.dataTransfer.getData("text/plain");
                    reorderSections(sourceId, section.id);
                  }}
                  className={clsx(
                    "flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition dark:border-zinc-800",
                    selectedSectionId === section.id
                      ? "border-[var(--site-accent)] bg-[var(--site-accent)]/10"
                      : "border-zinc-200 dark:border-zinc-800",
                  )}
                  onClick={() => setSelectedSectionId(section.id)}
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {section.title ?? friendlySectionLabels[section.type] ?? "Section"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {friendlySectionLabels[section.type] ?? section.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <button
                      type="button"
                      className="rounded border px-2 py-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        duplicateSection(section.id);
                      }}
                    >
                      Dupliquer
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeSection(section.id);
                      }}
                    >
                      Suppr.
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="card space-y-4 p-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Thème & style
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Couleurs, typographie et gabarits.
              </p>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Couleur d’accent
                <Input
                  type="color"
                  value={config.theme?.accent ?? "#2563eb"}
                  onChange={(event) =>
                    updateTheme({
                      accent: event.target.value,
                    })
                  }
                  className="mt-1 h-10 w-full cursor-pointer"
                />
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Typographie
                <select
                  className="input mt-1"
                  value={config.theme?.typography ?? "modern"}
                  onChange={(event) =>
                    updateTheme({ typography: event.target.value as WebsiteBuilderConfig["theme"]["typography"] })
                  }
                >
                  <option value="modern">Grotesk moderne</option>
                  <option value="serif">Sérif élégante</option>
                  <option value="editorial">Editorial</option>
                  <option value="tech">Technique</option>
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Forme des boutons
                <select
                  className="input mt-1"
                  value={config.theme?.buttonShape ?? "rounded"}
                  onChange={(event) =>
                    updateTheme({
                      buttonShape: event.target.value as WebsiteBuilderConfig["theme"]["buttonShape"],
                    })
                  }
                >
                  <option value="sharp">Angles droits</option>
                  <option value="rounded">Arrondis</option>
                  <option value="pill">Pilule</option>
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Largeur du contenu
                <select
                  className="input mt-1"
                  value={config.theme?.containerWidth ?? "default"}
                  onChange={(event) =>
                    updateTheme({
                      containerWidth: event.target.value as WebsiteBuilderConfig["theme"]["containerWidth"],
                    })
                  }
                >
                  <option value="narrow">Compact</option>
                  <option value="default">Standard</option>
                  <option value="wide">Large</option>
                </select>
              </label>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Espacement vertical
                <select
                  className="input mt-1"
                  value={config.theme?.sectionSpacing ?? "comfortable"}
                  onChange={(event) =>
                    updateTheme({
                      sectionSpacing: event.target.value as WebsiteBuilderConfig["theme"]["sectionSpacing"],
                    })
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Confortable</option>
                  <option value="spacious">Aéré</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card space-y-4 p-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Versions récentes
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Trois dernières sauvegardes conservées.
              </p>
            </div>
            <ol className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
              {history.length === 0 ? (
                <li>Aucune révision pour le moment.</li>
              ) : null}
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {entry.label ?? "Version précédente"}
                  </p>
                  <p>
                    {new Date(entry.savedAt).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-[11px] font-semibold text-[var(--site-accent)]"
                    onClick={() => restoreFromSnapshot(entry.snapshot)}
                  >
                    Restaurer la version
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <div className="card space-y-4 p-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Médias
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Téléversez vos visuels (compressés automatiquement).
              </p>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => void handleMediaUpload(event.target.files)}
              />
              Glissez vos images ou cliquez pour importer.
            </label>
            <div className="space-y-3">
              {mediaAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                >
                  <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800">
                    {asset.src ? (
                      <NextImage
                        src={asset.src}
                        alt={asset.alt}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized={asset.src.startsWith("data:")}
                      />
                    ) : (
                      <div className="h-full w-full bg-zinc-100 dark:bg-zinc-800" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Input
                      value={asset.alt ?? ""}
                      onChange={(event) =>
                        updateMediaAsset(asset.id, { alt: event.target.value })
                      }
                      placeholder="Texte alternatif"
                      className="text-xs"
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {asset.width}×{asset.height}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() => removeMediaAsset(asset.id)}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
              {mediaAssets.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Aucun média importé pour le moment.
                </p>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          {isCisecoTemplate ? (
            <section className="card space-y-4 p-6">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  SEO & métadonnées
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Titres, descriptions et visuels pour le partage.
                </p>
                {selectedPageKey === "product" ? (
                  <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Variables disponibles: {"{{product.name}}"}, {"{{product.category}}"}, {"{{site.name}}"}.
                  </p>
                ) : null}
              </div>
              <Input
                value={activePageConfig.seo?.title ?? ""}
                placeholder={
                  selectedPageKey === "product"
                    ? "Titre SEO (template)"
                    : "Titre SEO"
                }
                onChange={(event) =>
                  updatePageSeo({ title: event.target.value })
                }
              />
              <Textarea
                value={activePageConfig.seo?.description ?? ""}
                placeholder={
                  selectedPageKey === "product"
                    ? "Description SEO (template)"
                    : "Description SEO"
                }
                rows={3}
                onChange={(event) =>
                  updatePageSeo({ description: event.target.value })
                }
              />
              <Input
                value={activePageConfig.seo?.keywords ?? ""}
                placeholder="Mots-clés (optionnel)"
                onChange={(event) =>
                  updatePageSeo({ keywords: event.target.value })
                }
              />
              <MediaPlaceholderPicker
                label="Visuel de partage"
                description="Image affichée lors du partage sur les réseaux."
                value={activePageConfig.seo?.imageId ?? null}
                assets={mediaAssets}
                fallbackImage={WEBSITE_MEDIA_PLACEHOLDERS.hero}
                onChange={(nextValue) => updatePageSeo({ imageId: nextValue })}
                onUpload={(files) => void handleMediaUpload(files)}
              />
            </section>
          ) : null}
          {selectedSection ? (
            <section className="card space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    {friendlySectionLabels[selectedSection.type] ?? selectedSection.type}
                  </p>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedSection.title ?? "Section sans titre"}
                  </h2>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={selectedSection.visible !== false}
                    onChange={(event) =>
                      updateSection(selectedSection.id, () => ({
                        visible: event.target.checked,
                      }))
                    }
                  />
                  Visible
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={selectedSection.title ?? ""}
                  placeholder="Titre"
                  onChange={(event) =>
                    updateSection(selectedSection.id, () => ({
                      title: event.target.value,
                    }))
                  }
                />
                <Input
                  value={selectedSection.eyebrow ?? ""}
                  placeholder="Sur-titre"
                  onChange={(event) =>
                    updateSection(selectedSection.id, () => ({
                      eyebrow: event.target.value,
                    }))
                  }
                />
              </div>
              <Textarea
                value={selectedSection.subtitle ?? ""}
                placeholder="Sous-titre"
                rows={3}
                onChange={(event) =>
                  updateSection(selectedSection.id, () => ({
                    subtitle: event.target.value,
                  }))
                }
              />
              <Textarea
                value={selectedSection.description ?? ""}
                placeholder="Description / corps de texte"
                rows={4}
                onChange={(event) =>
                  updateSection(selectedSection.id, () => ({
                    description: event.target.value,
                  }))
                }
              />
              {sectionMediaFields.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {sectionMediaFields.map((field) => (
                    <MediaPlaceholderPicker
                      key={`${selectedSection.id}-${field.key}`}
                      label={field.label}
                      description={field.description}
                      value={selectedSection[field.key] ?? null}
                      assets={mediaAssets}
                      fallbackImage={field.placeholder}
                      onChange={(nextValue) =>
                        updateSection(
                          selectedSection.id,
                          () => ({
                            [field.key]: nextValue,
                          }) as Partial<WebsiteBuilderSection>,
                        )
                      }
                      onUpload={(files) => void handleMediaUpload(files)}
                    />
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Layout
                  <select
                    className="input mt-1"
                    value={selectedSection.layout ?? resolvedLayoutOptions[0] ?? "split"}
                    onChange={(event) =>
                      updateSection(selectedSection.id, () => ({
                        layout: event.target.value,
                      }))
                    }
                  >
                    {resolvedLayoutOptions.map((layout) => (
                      <option key={layout} value={layout}>
                        {layout}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Animation
                  <select
                    className="input mt-1"
                    value={selectedSection.animation ?? "fade"}
                    onChange={(event) => {
                      const value = event.target.value as WebsiteBuilderSection["animation"];
                      updateSection(selectedSection.id, () => ({
                        animation: value,
                      }));
                    }}
                  >
                    {animationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedSection.items ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                      Contenu
                    </p>
                    <button
                      type="button"
                      className="text-xs text-[var(--site-accent)]"
                      onClick={() =>
                        updateSection(selectedSection.id, (section) => ({
                          items: [
                            ...(section.items ?? []),
                            { id: generateId("item"), title: "Nouvel élément", stats: [] },
                          ],
                        }))
                      }
                    >
                      Ajouter
                    </button>
                  </div>
                  {(selectedSection.items ?? []).map((item, itemIndex) => {
                    const selectedAsset = mediaAssets.find((asset) => asset.id === item.mediaId) ?? null;
                    const placeholder = getSectionItemPlaceholder(selectedSection.type, itemIndex);
                    const itemPreviewSrc = selectedAsset?.src ?? placeholder;
                    const itemPreviewAlt = selectedAsset?.alt ?? item.title ?? "Illustration";
                    const itemPreviewUnoptimized = Boolean(selectedAsset?.src?.startsWith("data:"));
                    return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <p className="font-medium text-zinc-700 dark:text-zinc-200">
                          {item.title || "Élément"}
                        </p>
                        <button
                          type="button"
                          className="text-red-500"
                          onClick={() =>
                            updateSection(selectedSection.id, (section) => ({
                              items: section.items?.filter((value) => value.id !== item.id),
                            }))
                          }
                        >
                          Supprimer
                        </button>
                      </div>
                      <Input
                        className="mt-2"
                        placeholder="Titre"
                        value={item.title ?? ""}
                        onChange={(event) =>
                          updateItem(selectedSection.id, item.id, {
                            title: event.target.value,
                          })
                        }
                      />
                      <Textarea
                        className="mt-2"
                        rows={3}
                        placeholder="Description"
                        value={item.description ?? ""}
                        onChange={(event) =>
                          updateItem(selectedSection.id, item.id, {
                            description: event.target.value,
                          })
                        }
                      />
                      <Input
                        className="mt-2"
                        placeholder="Tag / rôle / icône"
                        value={item.tag ?? ""}
                        onChange={(event) =>
                          updateItem(selectedSection.id, item.id, {
                            tag: event.target.value,
                          })
                        }
                      />
                      <Input
                        className="mt-2"
                        placeholder="Badge / date"
                        value={item.badge ?? ""}
                        onChange={(event) =>
                          updateItem(selectedSection.id, item.id, {
                            badge: event.target.value,
                          })
                        }
                      />
                      <Input
                        className="mt-2"
                        placeholder="Prix / CTA secondaire"
                        value={item.price ?? ""}
                        onChange={(event) =>
                          updateItem(selectedSection.id, item.id, {
                            price: event.target.value,
                          })
                        }
                      />
                      <Input
                        className="mt-2"
                        placeholder="Libellé du lien"
                        value={item.linkLabel ?? ""}
                        onChange={(event) =>
                          updateItem(selectedSection.id, item.id, {
                            linkLabel: event.target.value,
                          })
                        }
                      />
                      <Input
                        className="mt-2"
                        placeholder="Lien (URL ou slug)"
                        value={item.href ?? ""}
                        onChange={(event) =>
                          updateItem(selectedSection.id, item.id, {
                            href: event.target.value,
                          })
                        }
                      />
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                          Illustration
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                            {itemPreviewSrc ? (
                              <NextImage
                                src={itemPreviewSrc}
                                alt={itemPreviewAlt}
                                fill
                                sizes="56px"
                                className="object-cover"
                                unoptimized={itemPreviewUnoptimized}
                              />
                            ) : (
                              <span className="block text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                                Placeholder
                              </span>
                            )}
                          </div>
                          <select
                            className="input"
                            value={item.mediaId ?? ""}
                            onChange={(event) =>
                              updateItem(selectedSection.id, item.id, {
                                mediaId: event.target.value || null,
                              })
                            }
                          >
                            <option value="">Placeholder par défaut</option>
                            {mediaAssets.map((asset) => (
                              <option key={asset.id} value={asset.id}>
                                {asset.alt || asset.id}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              ) : null}
              {selectedSection ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                      Boutons
                    </p>
                    <button
                      type="button"
                      className="text-xs text-[var(--site-accent)] disabled:text-zinc-400 dark:disabled:text-zinc-600"
                      disabled={
                        (selectedSection.buttons?.length ?? 0) >=
                        BUILDER_SECTION_BUTTON_LIMIT
                      }
                      onClick={() =>
                        updateSection(selectedSection.id, (section) => {
                          if (
                            (section.buttons?.length ?? 0) >=
                            BUILDER_SECTION_BUTTON_LIMIT
                          ) {
                            return { buttons: section.buttons };
                          }
                          return {
                            buttons: [
                              ...(section.buttons ?? []),
                              {
                                id: generateId("btn"),
                                label: "Nouvel appel à l'action",
                                href: "#contact",
                                style: "primary",
                              },
                            ],
                          };
                        })
                      }
                    >
                      Ajouter un bouton
                    </button>
                  </div>
                  {(selectedSection.buttons ?? []).map((button) => (
                    <div
                      key={button.id}
                      className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <p className="font-medium text-zinc-700 dark:text-zinc-200">
                          {button.label || "CTA"}
                        </p>
                        <button
                          type="button"
                          className="text-red-500"
                          onClick={() =>
                            updateSection(selectedSection.id, (section) => ({
                              buttons: section.buttons?.filter((entry) => entry.id !== button.id),
                            }))
                          }
                        >
                          Supprimer
                        </button>
                      </div>
                      <Input
                        className="mt-2"
                        placeholder="Libellé"
                        value={button.label ?? ""}
                        onChange={(event) =>
                          updateButton(selectedSection.id, button.id, {
                            label: event.target.value,
                          })
                        }
                      />
                      <Input
                        className="mt-2"
                        placeholder="#contact"
                        value={button.href ?? ""}
                        onChange={(event) =>
                          updateButton(selectedSection.id, button.id, {
                            href: event.target.value,
                          })
                        }
                      />
                      <label className="mt-2 block text-xs text-zinc-500 dark:text-zinc-400">
                        Style
                        <select
                          className="input mt-1"
                          value={button.style ?? "primary"}
                          onChange={(event) =>
                            updateButton(selectedSection.id, button.id, {
                              style: event.target.value as WebsiteBuilderButton["style"],
                            })
                          }
                        >
                          <option value="primary">Principal</option>
                          <option value="secondary">Secondaire</option>
                          <option value="ghost">Ghost</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {isCisecoTemplate ? (
            <section className="card space-y-4 p-6">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Signup
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Activez les fournisseurs sociaux et la redirection après inscription.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Redirection après inscription
                </label>
                <select
                  className="input"
                  value={signupSettings.redirectTarget}
                  onChange={(event) =>
                    updateSignupRedirectTarget(
                      event.target.value as SignupSettingsInput["redirectTarget"],
                    )
                  }
                >
                  <option value="home">Accueil</option>
                  <option value="account">Compte</option>
                </select>
              </div>
              <div className="space-y-3">
                {SIGNUP_PROVIDERS.map((provider) => {
                  const config = signupSettings.providers[provider.id];
                  return (
                    <div
                      key={provider.id}
                      className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                            {provider.label}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {provider.description}
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300 text-[var(--site-accent)] focus:ring-[var(--site-accent)]"
                            checked={config.enabled}
                            onChange={(event) =>
                              updateSignupProvider(provider.id, {
                                enabled: event.target.checked,
                              })
                            }
                          />
                          Activé
                        </label>
                      </div>
                      <div className="mt-3 space-y-3">
                        <label className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-zinc-300 text-[var(--site-accent)] focus:ring-[var(--site-accent)]"
                            checked={config.useEnv}
                            onChange={(event) =>
                              updateSignupProvider(provider.id, {
                                useEnv: event.target.checked,
                              })
                            }
                          />
                          Utiliser les identifiants de l’environnement
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            placeholder="Client ID"
                            value={config.clientId ?? ""}
                            disabled={config.useEnv}
                            onChange={(event) =>
                              updateSignupProvider(provider.id, {
                                clientId: event.target.value,
                              })
                            }
                          />
                          <Input
                            placeholder="Client secret"
                            type="password"
                            value={config.clientSecret ?? ""}
                            disabled={config.useEnv}
                            onChange={(event) =>
                              updateSignupProvider(provider.id, {
                                clientSecret: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {isCisecoTemplate ? (
            <section className="card space-y-4 p-6">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Page contact
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Coordonnées, texte d’introduction et liens sociaux affichés sur la page Contact.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={contactSettings.email}
                  placeholder="Email"
                  onChange={(event) =>
                    updateContactField("email", event.target.value)
                  }
                />
                <Input
                  value={contactSettings.phone}
                  placeholder="Téléphone"
                  onChange={(event) =>
                    updateContactField("phone", event.target.value)
                  }
                />
              </div>
              <Input
                value={contactSettings.address}
                placeholder="Adresse"
                onChange={(event) =>
                  updateContactField("address", event.target.value)
                }
              />
              <Textarea
                value={contactSettings.intro}
                placeholder="Texte d’introduction (optionnel)"
                rows={4}
                onChange={(event) =>
                  updateContactField("intro", event.target.value)
                }
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    Réseaux sociaux
                  </p>
                  <button
                    type="button"
                    className="text-xs text-[var(--site-accent)] disabled:text-zinc-400 dark:disabled:text-zinc-600"
                    disabled={
                      contactSettings.socialLinks.length >= 6 ||
                      CONTACT_SOCIAL_ICON_OPTIONS.length === 0
                    }
                    onClick={addSocialLink}
                  >
                    Ajouter un lien
                  </button>
                </div>
                {contactSettings.socialLinks.length ? (
                  <div className="space-y-3">
                    {contactSettings.socialLinks.map((link) => (
                      <div
                        key={link.id}
                        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <p className="font-medium text-zinc-700 dark:text-zinc-200">
                            {link.label || "Lien social"}
                          </p>
                          <button
                            type="button"
                            className="text-red-500"
                            onClick={() => removeSocialLink(link.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                        <Input
                          className="mt-2"
                          placeholder="Libellé"
                          value={link.label}
                          onChange={(event) =>
                            updateSocialLink(link.id, {
                              label: event.target.value,
                            })
                          }
                        />
                        <Input
                          className="mt-2"
                          placeholder="https://"
                          value={link.href}
                          onChange={(event) =>
                            updateSocialLink(link.id, {
                              href: event.target.value,
                            })
                          }
                        />
                        <label className="mt-2 block text-xs text-zinc-500 dark:text-zinc-400">
                          Icône
                          <select
                            className="input mt-1"
                            value={link.icon}
                            onChange={(event) =>
                              updateSocialLink(link.id, {
                                icon: event.target
                                  .value as ContactSocialLink["icon"],
                              })
                            }
                          >
                            {CONTACT_SOCIAL_ICON_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    Ajoutez vos réseaux sociaux pour les afficher sur la page Contact.
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <section className="card space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Aperçu live
              </h2>
              <div className="inline-flex overflow-hidden rounded-full border border-zinc-200 text-xs dark:border-zinc-800">
                {(["desktop", "tablet", "mobile"] as Device[]).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setDevice(entry)}
                    className={clsx(
                      "px-3 py-1 capitalize transition",
                      device === entry
                        ? "bg-[var(--site-accent)] text-white"
                        : "text-zinc-500 dark:text-zinc-400",
                    )}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[32px] border border-zinc-200 bg-gradient-to-b from-white via-white to-zinc-50 p-4 dark:border-zinc-800 dark:bg-gradient-to-b dark:from-zinc-900 dark:via-zinc-950 dark:to-black/60">
              <div
                className={clsx(
                  "relative mx-auto rounded-[30px] bg-zinc-100/70 shadow-inner dark:bg-zinc-900/40",
                  deviceFramePadding[device],
                )}
              >
                {device !== "desktop" ? (
                  <div className="pointer-events-none absolute inset-x-1/2 top-2 h-3 w-24 -translate-x-1/2 rounded-full bg-zinc-400/70 dark:bg-white/20" />
                ) : null}
                <div
                  ref={previewRef}
                  className={clsx(
                    "builder-preview-viewport relative w-full overflow-y-auto rounded-[28px] border border-zinc-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950",
                    devicePreviewClass[device],
                  )}
                  style={{ maxHeight: "75vh" }}
                >
                  <CatalogPage
                    data={previewPayload}
                    mode="preview"
                    path={isCisecoTemplate ? previewPath : null}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <style jsx global>{`
        .builder-preview-viewport {
          scrollbar-width: thin;
        }
        .builder-preview-viewport::-webkit-scrollbar {
          width: 6px;
        }
        .builder-preview-viewport::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 999px;
        }
        .dark .builder-preview-viewport::-webkit-scrollbar-thumb {
          background: rgba(248, 250, 252, 0.2);
        }
        .builder-preview-viewport header {
          position: static !important;
          top: auto !important;
          backdrop-filter: none !important;
        }
        .builder-preview-viewport main {
          padding-top: 0 !important;
        }
      `}</style>
    </div>
  );
}

const friendlySectionLabels: Record<string, string> = {
  hero: "Héros",
  categories: "Catégories",
  products: "Produits",
  promo: "Promotion",
  newsletter: "Newsletter",
  content: "Bloc éditorial",
  services: "Services",
  about: "À propos",
  contact: "Contact",
  testimonials: "Témoignages",
  team: "Équipe",
  gallery: "Portfolio",
  pricing: "Tarifs",
  faq: "FAQ",
  logos: "Logos",
};
