"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { fromCents } from "@/lib/money";
import type { CurrencyCode } from "@/lib/currency";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast-provider";
import { generateId } from "@/lib/id";
import { slugify } from "@/lib/slug";
import {
  submitProductFormAction,
} from "@/app/(app)/produits/actions";
import {
  INITIAL_PRODUCT_FORM_STATE,
  type ProductFormState,
} from "@/app/(app)/produits/form-state";
import type { Route } from "next";

type ProductFormProps = {
  submitLabel: string;
  currencyCode: CurrencyCode;
  defaultValues?: {
    id?: string;
    sku?: string;
    name?: string;
    publicSlug?: string;
    saleMode?: "INSTANT" | "QUOTE";
    description?: string | null;
    descriptionHtml?: string | null;
    excerpt?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    coverImageUrl?: string | null;
    gallery?: unknown | null;
    quoteFormSchema?: unknown | null;
    optionConfig?: unknown | null;
    variantStock?: unknown | null;
    category?: string | null;
    unit?: string;
    stockQuantity?: number | null;
    priceHTCents?: number;
    vatRate?: number;
    defaultDiscountRate?: number | null;
    isActive?: boolean;
    isListedInCatalog?: boolean;
  };
  redirectTo?: string;
};

type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  isPrimary: boolean;
};

type OptionValue = {
  id: string;
  label: string;
  enabled: boolean;
  swatch?: string | null;
};

type OptionGroup = {
  id: string;
  name: string;
  values: OptionValue[];
};

type OptionConfigState = {
  colors: OptionValue[];
  sizes: OptionValue[];
  options: OptionGroup[];
};

type OptionKind = "colors" | "sizes";

type VariantStockMap = Record<string, string>;

const VARIANT_SEPARATOR = "::";

function buildVariantKey(colorId?: string | null, sizeId?: string | null) {
  return `${colorId ?? ""}${VARIANT_SEPARATOR}${sizeId ?? ""}`;
}

function normalizeGalleryItems(
  gallery: unknown,
  coverImageUrl?: string | null,
): GalleryItem[] {
  const entries: GalleryItem[] = [];
  if (Array.isArray(gallery)) {
    gallery.forEach((entry, index) => {
      if (typeof entry === "string") {
        const src = entry.trim();
        if (!src) return;
        entries.push({
          id: generateId("photo"),
          src,
          alt: "",
          isPrimary: false,
        });
        return;
      }
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const src =
          typeof record.src === "string"
            ? record.src.trim()
            : typeof record.url === "string"
              ? record.url.trim()
              : "";
        if (!src) return;
        const alt =
          typeof record.alt === "string" ? record.alt : "";
        const id =
          typeof record.id === "string" && record.id.trim().length > 0
            ? record.id.trim()
            : generateId("photo");
        entries.push({
          id,
          src,
          alt,
          isPrimary: Boolean(record.isPrimary),
        });
      }
    });
  }
  const coverSrc = coverImageUrl?.trim();
  if (coverSrc && !entries.some((item) => item.src === coverSrc)) {
    entries.unshift({
      id: generateId("photo"),
      src: coverSrc,
      alt: "",
      isPrimary: true,
    });
  }
  const primaryIndex = entries.findIndex((item) => item.isPrimary);
  if (primaryIndex === -1 && entries.length) {
    entries[0].isPrimary = true;
  } else if (primaryIndex >= 0) {
    entries.forEach((item, index) => {
      item.isPrimary = index === primaryIndex;
    });
  }
  return entries;
}

function normalizeOptionValues(value: unknown, fallbackPrefix: string): OptionValue[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<OptionValue[]>((entries, entry, index) => {
      if (!entry || typeof entry !== "object") return entries;
      const record = entry as Record<string, unknown>;
      const label =
        typeof record.label === "string"
          ? record.label
          : typeof record.title === "string"
            ? record.title
            : typeof record.name === "string"
              ? record.name
              : "";
      const trimmedLabel = label.trim();
      const rawId =
        typeof record.id === "string"
          ? record.id
          : typeof record.value === "string"
            ? record.value
            : "";
      const resolvedId = rawId.trim() || slugify(trimmedLabel || `${fallbackPrefix}-${index + 1}`);
      entries.push({
        id: resolvedId,
        label: trimmedLabel || resolvedId,
        enabled: record.enabled !== false,
        swatch:
          typeof record.swatch === "string"
            ? record.swatch
            : null,
      } satisfies OptionValue);
      return entries;
    }, []);
}

function normalizeOptionGroups(value: unknown): OptionGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const name =
        typeof record.name === "string"
          ? record.name
          : typeof record.label === "string"
            ? record.label
            : typeof record.title === "string"
              ? record.title
              : "";
      const trimmedName = name.trim();
      const rawId =
        typeof record.id === "string"
          ? record.id
          : typeof record.key === "string"
            ? record.key
            : "";
      const resolvedId =
        rawId.trim() || slugify(trimmedName || `option-${index + 1}`);
      const valuesSource = Array.isArray(record.values)
        ? record.values
        : Array.isArray(record.options)
          ? record.options
          : [];
      return {
        id: resolvedId,
        name: trimmedName || `Option ${index + 1}`,
        values: normalizeOptionValues(valuesSource, resolvedId || `option-${index + 1}`),
      } satisfies OptionGroup;
    })
    .filter((entry): entry is OptionGroup => Boolean(entry?.id));
}

function normalizeOptionConfig(value: unknown): OptionConfigState {
  if (!value || typeof value !== "object") {
    return { colors: [], sizes: [], options: [] };
  }
  const record = value as Record<string, unknown>;
  return {
    colors: normalizeOptionValues(record.colors, "color"),
    sizes: normalizeOptionValues(record.sizes, "size"),
    options: normalizeOptionGroups(
      Array.isArray(record.options)
        ? record.options
        : Array.isArray(record.customOptions)
          ? record.customOptions
          : Array.isArray(record.custom)
            ? record.custom
            : [],
    ),
  };
}

function normalizeVariantStockMap(value: unknown): VariantStockMap {
  if (!Array.isArray(value)) return {};
  return value.reduce<VariantStockMap>((acc, entry) => {
    if (!entry || typeof entry !== "object") return acc;
    const record = entry as Record<string, unknown>;
    const colorId =
      typeof record.colorId === "string" ? record.colorId : null;
    const sizeId =
      typeof record.sizeId === "string" ? record.sizeId : null;
    const stockValue =
      typeof record.stock === "number"
        ? record.stock
        : typeof record.stock === "string"
          ? Number(record.stock)
          : null;
    if (stockValue == null || !Number.isFinite(stockValue)) return acc;
    const key = buildVariantKey(colorId, sizeId);
    acc[key] = String(Math.max(0, Math.floor(stockValue)));
    return acc;
  }, {});
}

async function optimizeImage(file: File): Promise<GalleryItem> {
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
      id: generateId("photo"),
      src: dataUrl,
      alt: file.name,
      isPrimary: false,
    };
  }
  context.drawImage(loaded, 0, 0, width, height);
  const optimized = canvas.toDataURL("image/webp", 0.82);
  return {
    id: generateId("photo"),
    src: optimized,
    alt: file.name,
    isPrimary: false,
  };
}

export function ProductForm({
  submitLabel,
  defaultValues,
  currencyCode,
  redirectTo,
}: ProductFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [formState, formAction] = useActionState<ProductFormState, FormData>(
    submitProductFormAction,
    INITIAL_PRODUCT_FORM_STATE,
  );

  useEffect(() => {
    if (formState.status === "success") {
      addToast({
        variant: "success",
        title: formState.message ?? "Produit enregistré",
      });
      const destination =
        redirectTo && redirectTo.startsWith("/")
          ? redirectTo
          : "/produits";
      router.push(destination as Route);
    }
  }, [
    addToast,
    formState.message,
    formState.status,
    redirectTo,
    router,
  ]);

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(() =>
    normalizeGalleryItems(
      defaultValues?.gallery,
      defaultValues?.coverImageUrl ?? null,
    ),
  );
  const [photoUrl, setPhotoUrl] = useState("");
  const [optionConfig, setOptionConfig] = useState<OptionConfigState>(() =>
    normalizeOptionConfig(defaultValues?.optionConfig),
  );
  const [variantStock, setVariantStock] = useState<VariantStockMap>(() =>
    normalizeVariantStockMap(defaultValues?.variantStock),
  );

  useEffect(() => {
    if (!optionConfig.colors.length && !optionConfig.sizes.length) {
      setVariantStock((prev) =>
        Object.keys(prev).length > 0 ? {} : prev,
      );
      return;
    }
    const allowedKeys = new Set<string>();
    if (optionConfig.colors.length && optionConfig.sizes.length) {
      optionConfig.colors.forEach((color) => {
        optionConfig.sizes.forEach((size) => {
          allowedKeys.add(buildVariantKey(color.id, size.id));
        });
      });
    } else if (optionConfig.colors.length) {
      optionConfig.colors.forEach((color) => {
        allowedKeys.add(buildVariantKey(color.id, null));
      });
    } else {
      optionConfig.sizes.forEach((size) => {
        allowedKeys.add(buildVariantKey(null, size.id));
      });
    }
    setVariantStock((prev) => {
      const entries = Object.entries(prev).filter(([key]) =>
        allowedKeys.has(key),
      );
      if (entries.length === Object.keys(prev).length) return prev;
      return Object.fromEntries(entries);
    });
  }, [optionConfig.colors, optionConfig.sizes]);

  const fieldErrors = formState.fieldErrors ?? {};
  const target = redirectTo ?? "/produits";
  const quoteFormSchemaValue =
    defaultValues?.quoteFormSchema != null
      ? JSON.stringify(defaultValues.quoteFormSchema, null, 2)
      : "";

  const galleryPayload = useMemo(() => {
    if (!galleryItems.length) return "";
    const payload = galleryItems.map((item, index) => ({
      id: item.id,
      src: item.src,
      alt: item.alt || null,
      isPrimary: item.isPrimary,
      position: index,
    }));
    return JSON.stringify(payload);
  }, [galleryItems]);

  const coverImageUrlValue = useMemo(() => {
    const primary = galleryItems.find((item) => item.isPrimary);
    return primary?.src ?? galleryItems[0]?.src ?? "";
  }, [galleryItems]);

  const optionConfigPayload = useMemo(() => {
    if (
      !optionConfig.colors.length &&
      !optionConfig.sizes.length &&
      !optionConfig.options.length
    ) {
      return "";
    }
    return JSON.stringify(optionConfig);
  }, [optionConfig]);

  const variantStockPayload = useMemo(() => {
    const entries = Object.entries(variantStock)
      .map(([key, value]) => {
        const trimmed = value.trim();
        if (!trimmed.length) return null;
        const stock = Number(trimmed);
        if (!Number.isFinite(stock)) return null;
        const [colorId, sizeId] = key.split(VARIANT_SEPARATOR);
        return {
          colorId: colorId || null,
          sizeId: sizeId || null,
          stock: Math.max(0, Math.floor(stock)),
        };
      })
      .filter((entry): entry is { colorId: string | null; sizeId: string | null; stock: number } =>
        Boolean(entry),
      );
    if (!entries.length) return "";
    return JSON.stringify(entries);
  }, [variantStock]);

  async function handlePhotoUpload(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    const uploads: GalleryItem[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const processed = await optimizeImage(file);
        uploads.push(processed);
      } catch (error) {
        console.error("[product-form] upload failed", error);
      }
    }
    if (!uploads.length) return;
    setGalleryItems((prev) => {
      const next = [...prev, ...uploads];
      if (!next.some((item) => item.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  }

  function handleAddPhotoUrl() {
    const trimmed = photoUrl.trim();
    if (!trimmed) return;
    setGalleryItems((prev) => {
      const next = [
        ...prev,
        {
          id: generateId("photo"),
          src: trimmed,
          alt: "",
          isPrimary: prev.length === 0,
        },
      ];
      return next;
    });
    setPhotoUrl("");
  }

  function setPrimaryPhoto(targetId: string) {
    setGalleryItems((prev) =>
      prev.map((item) => ({
        ...item,
        isPrimary: item.id === targetId,
      })),
    );
  }

  function movePhoto(targetId: string, direction: "up" | "down") {
    setGalleryItems((prev) => {
      const index = prev.findIndex((item) => item.id === targetId);
      if (index === -1) return prev;
      const next = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[swapIndex];
      next[swapIndex] = temp;
      return next;
    });
  }

  function removePhoto(targetId: string) {
    setGalleryItems((prev) => {
      const next = prev.filter((item) => item.id !== targetId);
      if (!next.length) return next;
      if (!next.some((item) => item.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  }

  function updateOption(kind: OptionKind, id: string, changes: Partial<OptionValue>) {
    setOptionConfig((prev) => ({
      ...prev,
      [kind]: prev[kind].map((option) =>
        option.id === id ? { ...option, ...changes } : option,
      ),
    }));
  }

  function moveOption(kind: OptionKind, index: number, direction: "up" | "down") {
    setOptionConfig((prev) => {
      const items = [...prev[kind]];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= items.length) return prev;
      const temp = items[index];
      items[index] = items[swapIndex];
      items[swapIndex] = temp;
      return { ...prev, [kind]: items };
    });
  }

  function removeOption(kind: OptionKind, id: string) {
    setOptionConfig((prev) => ({
      ...prev,
      [kind]: prev[kind].filter((option) => option.id !== id),
    }));
  }

  function addOption(kind: OptionKind) {
    setOptionConfig((prev) => {
      const existingIds = new Set(prev[kind].map((option) => option.id));
      const baseLabel = kind === "colors" ? "New color" : "New size";
      const baseId = slugify(baseLabel) || `${kind}-option`;
      let candidate = baseId;
      let attempt = 1;
      while (existingIds.has(candidate)) {
        attempt += 1;
        candidate = `${baseId}-${attempt}`;
      }
      const nextOption: OptionValue = {
        id: candidate,
        label: baseLabel,
        enabled: true,
        swatch: kind === "colors" ? "#111827" : undefined,
      };
      return {
        ...prev,
        [kind]: [...prev[kind], nextOption],
      };
    });
  }

  function updateOptionGroup(groupId: string, changes: Partial<OptionGroup>) {
    setOptionConfig((prev) => ({
      ...prev,
      options: prev.options.map((group) =>
        group.id === groupId ? { ...group, ...changes } : group,
      ),
    }));
  }

  function moveOptionGroup(index: number, direction: "up" | "down") {
    setOptionConfig((prev) => {
      const groups = [...prev.options];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= groups.length) return prev;
      const temp = groups[index];
      groups[index] = groups[swapIndex];
      groups[swapIndex] = temp;
      return { ...prev, options: groups };
    });
  }

  function removeOptionGroup(groupId: string) {
    setOptionConfig((prev) => ({
      ...prev,
      options: prev.options.filter((group) => group.id !== groupId),
    }));
  }

  function addOptionGroup() {
    setOptionConfig((prev) => {
      const existingIds = new Set(prev.options.map((group) => group.id));
      const baseLabel = "Nouvelle option";
      const baseId = slugify(baseLabel) || "option";
      let candidate = baseId;
      let attempt = 1;
      while (existingIds.has(candidate)) {
        attempt += 1;
        candidate = `${baseId}-${attempt}`;
      }
      const nextGroup: OptionGroup = {
        id: candidate,
        name: baseLabel,
        values: [],
      };
      return { ...prev, options: [...prev.options, nextGroup] };
    });
  }

  function updateOptionGroupValue(
    groupId: string,
    valueId: string,
    changes: Partial<OptionValue>,
  ) {
    setOptionConfig((prev) => ({
      ...prev,
      options: prev.options.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          values: group.values.map((value) =>
            value.id === valueId ? { ...value, ...changes } : value,
          ),
        };
      }),
    }));
  }

  function moveOptionGroupValue(
    groupId: string,
    index: number,
    direction: "up" | "down",
  ) {
    setOptionConfig((prev) => ({
      ...prev,
      options: prev.options.map((group) => {
        if (group.id !== groupId) return group;
        const values = [...group.values];
        const swapIndex = direction === "up" ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= values.length) return group;
        const temp = values[index];
        values[index] = values[swapIndex];
        values[swapIndex] = temp;
        return { ...group, values };
      }),
    }));
  }

  function removeOptionGroupValue(groupId: string, valueId: string) {
    setOptionConfig((prev) => ({
      ...prev,
      options: prev.options.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          values: group.values.filter((value) => value.id !== valueId),
        };
      }),
    }));
  }

  function addOptionGroupValue(groupId: string) {
    setOptionConfig((prev) => {
      const target = prev.options.find((group) => group.id === groupId);
      if (!target) return prev;
      const existingIds = new Set(target.values.map((value) => value.id));
      const baseLabel = "Nouvelle valeur";
      const baseId = slugify(baseLabel) || `${groupId}-value`;
      let candidate = baseId;
      let attempt = 1;
      while (existingIds.has(candidate)) {
        attempt += 1;
        candidate = `${baseId}-${attempt}`;
      }
      const nextValue: OptionValue = {
        id: candidate,
        label: baseLabel,
        enabled: true,
      };
      return {
        ...prev,
        options: prev.options.map((group) =>
          group.id === groupId
            ? { ...group, values: [...group.values, nextValue] }
            : group,
        ),
      };
    });
  }

  return (
    <form action={formAction} className="card space-y-5 p-4 sm:p-6">
      <input type="hidden" name="redirectTo" value={target} />
      <input type="hidden" name="productId" value={defaultValues?.id ?? ""} />
      <input type="hidden" name="gallery" value={galleryPayload} />
      <input type="hidden" name="coverImageUrl" value={coverImageUrlValue} />
      <input type="hidden" name="optionConfig" value={optionConfigPayload} />
      <input type="hidden" name="variantStock" value={variantStockPayload} />
      {formState.status === "error" && formState.message ? (
        <Alert variant="error" title={formState.message} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <label htmlFor="sku" className="label">
            SKU / Référence
          </label>
          <Input
            id="sku"
            name="sku"
            defaultValue={defaultValues?.sku ?? ""}
            required
            aria-invalid={Boolean(fieldErrors.sku) || undefined}
            data-invalid={fieldErrors.sku ? "true" : undefined}
          />
          {fieldErrors.sku ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.sku}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2 sm:col-span-2 md:col-span-2">
          <label htmlFor="name" className="label">
            Nom du produit ou service
          </label>
          <Input
            id="name"
            name="name"
            defaultValue={defaultValues?.name ?? ""}
            required
            aria-invalid={Boolean(fieldErrors.name) || undefined}
            data-invalid={fieldErrors.name ? "true" : undefined}
          />
          {fieldErrors.name ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <label htmlFor="saleMode" className="label">
            Mode de vente
          </label>
          <select
            id="saleMode"
            name="saleMode"
            className="input"
            defaultValue={defaultValues?.saleMode ?? "INSTANT"}
            aria-invalid={Boolean(fieldErrors.saleMode) || undefined}
            data-invalid={fieldErrors.saleMode ? "true" : undefined}
          >
            <option value="INSTANT">Achat direct</option>
            <option value="QUOTE">Demande de devis</option>
          </select>
          {fieldErrors.saleMode ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.saleMode}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="publicSlug" className="label">
            Slug public
          </label>
          <Input
            id="publicSlug"
            name="publicSlug"
            defaultValue={defaultValues?.publicSlug ?? ""}
            placeholder="ex: audit-croissance"
            aria-invalid={Boolean(fieldErrors.publicSlug) || undefined}
            data-invalid={fieldErrors.publicSlug ? "true" : undefined}
          />
          {fieldErrors.publicSlug ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.publicSlug}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Laissez vide pour générer le slug depuis le SKU à la création.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="label">
          Description
        </label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="excerpt" className="label">
          Extrait catalogue
        </label>
        <Textarea
          id="excerpt"
          name="excerpt"
          rows={3}
          defaultValue={defaultValues?.excerpt ?? ""}
          aria-invalid={Boolean(fieldErrors.excerpt) || undefined}
          data-invalid={fieldErrors.excerpt ? "true" : undefined}
        />
        {fieldErrors.excerpt ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.excerpt}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="descriptionHtml" className="label">
          Description détaillée (HTML)
        </label>
        <Textarea
          id="descriptionHtml"
          name="descriptionHtml"
          rows={6}
          defaultValue={defaultValues?.descriptionHtml ?? ""}
          className="font-mono text-xs"
          aria-invalid={Boolean(fieldErrors.descriptionHtml) || undefined}
          data-invalid={fieldErrors.descriptionHtml ? "true" : undefined}
        />
        {fieldErrors.descriptionHtml ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.descriptionHtml}
          </p>
        ) : null}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Le HTML est filtré automatiquement pour garantir la sécurité.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <label htmlFor="metaTitle" className="label">
            Meta title
          </label>
          <Input
            id="metaTitle"
            name="metaTitle"
            defaultValue={defaultValues?.metaTitle ?? ""}
            aria-invalid={Boolean(fieldErrors.metaTitle) || undefined}
            data-invalid={fieldErrors.metaTitle ? "true" : undefined}
          />
          {fieldErrors.metaTitle ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.metaTitle}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="metaDescription" className="label">
            Meta description
          </label>
          <Textarea
            id="metaDescription"
            name="metaDescription"
            rows={3}
            defaultValue={defaultValues?.metaDescription ?? ""}
            aria-invalid={Boolean(fieldErrors.metaDescription) || undefined}
            data-invalid={fieldErrors.metaDescription ? "true" : undefined}
          />
          {fieldErrors.metaDescription ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.metaDescription}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0 space-y-2">
          <label htmlFor="category" className="label">
            Catégorie
          </label>
          <Input
            id="category"
            name="category"
            defaultValue={defaultValues?.category ?? ""}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="unit" className="label">
            Unité
          </label>
          <Input
            id="unit"
            name="unit"
            defaultValue={defaultValues?.unit ?? "unité"}
            aria-invalid={Boolean(fieldErrors.unit) || undefined}
            data-invalid={fieldErrors.unit ? "true" : undefined}
          />
          {fieldErrors.unit ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.unit}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="stockQuantity" className="label">
            Stock (quantité)
          </label>
          <Input
            id="stockQuantity"
            name="stockQuantity"
            type="number"
            min="0"
            step="1"
            defaultValue={
              typeof defaultValues?.stockQuantity === "number"
                ? defaultValues.stockQuantity
                : ""
            }
            aria-invalid={Boolean(fieldErrors.stockQuantity) || undefined}
            data-invalid={fieldErrors.stockQuantity ? "true" : undefined}
          />
          {fieldErrors.stockQuantity ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.stockQuantity}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Laissez vide pour ne pas suivre le stock.
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="isActive" className="label">
            Statut
          </label>
          <select
            id="isActive"
            name="isActive"
            className="input"
            defaultValue={defaultValues?.isActive === false ? "false" : "true"}
          >
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="isListedInCatalog" className="label">
            Catalogue public
          </label>
          <select
            id="isListedInCatalog"
            name="isListedInCatalog"
            className="input"
            defaultValue={
              defaultValues?.isListedInCatalog === false ? "false" : "true"
            }
          >
            <option value="true">Visible</option>
            <option value="false">Masqué</option>
          </select>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Masquez un produit si vous ne souhaitez pas l’afficher sur le site.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="label">Photos du produit</label>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => void handlePhotoUpload(event.target.files)}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={photoUrl}
              onChange={(event) => setPhotoUrl(event.target.value)}
              placeholder="Ajouter une URL d'image"
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-10 px-3 py-2 text-sm"
              onClick={handleAddPhotoUrl}
            >
              Ajouter l’URL
            </Button>
          </div>
          {fieldErrors.coverImageUrl ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.coverImageUrl}
            </p>
          ) : null}
          {fieldErrors.gallery ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.gallery}
            </p>
          ) : null}
          {galleryItems.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {galleryItems.map((item, index) => (
                <div
                  key={item.id}
                  className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
                    <img
                      src={item.src}
                      alt={item.alt || `Photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Button
                      type="button"
                      variant={item.isPrimary ? "primary" : "ghost"}
                      className="min-h-8 px-2 py-1 text-xs"
                      onClick={() => setPrimaryPhoto(item.id)}
                    >
                      {item.isPrimary ? "Principale" : "Définir principale"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-8 px-2 py-1 text-xs text-red-600 dark:text-red-400"
                      onClick={() => removePhoto(item.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-8 px-2 py-1 text-xs"
                      onClick={() => movePhoto(item.id, "up")}
                      disabled={index === 0}
                    >
                      Monter
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-8 px-2 py-1 text-xs"
                      onClick={() => movePhoto(item.id, "down")}
                      disabled={index === galleryItems.length - 1}
                    >
                      Descendre
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ajoutez des photos pour alimenter la galerie du produit.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Options du produit
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Gérez les couleurs, tailles et options visibles sur la fiche produit.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Couleurs
              </p>
              <Button
                type="button"
                variant="secondary"
                className="min-h-8 px-2 py-1 text-xs"
                onClick={() => addOption("colors")}
              >
                Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {optionConfig.colors.length ? (
                optionConfig.colors.map((option, index) => (
                  <div
                    key={option.id}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Input
                      value={option.label}
                      onChange={(event) =>
                        updateOption("colors", option.id, {
                          label: event.target.value,
                        })
                      }
                      className="min-w-[140px] flex-1"
                    />
                    <input
                      type="color"
                      value={option.swatch ?? "#111827"}
                      onChange={(event) =>
                        updateOption("colors", option.id, {
                          swatch: event.target.value,
                        })
                      }
                      className="h-10 w-12 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900"
                      aria-label={`Couleur pour ${option.label}`}
                    />
                    <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={option.enabled}
                        onChange={(event) =>
                          updateOption("colors", option.id, {
                            enabled: event.target.checked,
                          })
                        }
                      />
                      Actif
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs"
                        onClick={() => moveOption("colors", index, "up")}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs"
                        onClick={() => moveOption("colors", index, "down")}
                        disabled={index === optionConfig.colors.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs text-red-600 dark:text-red-400"
                        onClick={() => removeOption("colors", option.id)}
                      >
                        Retirer
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Aucune couleur configurée.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Tailles
              </p>
              <Button
                type="button"
                variant="secondary"
                className="min-h-8 px-2 py-1 text-xs"
                onClick={() => addOption("sizes")}
              >
                Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {optionConfig.sizes.length ? (
                optionConfig.sizes.map((option, index) => (
                  <div
                    key={option.id}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Input
                      value={option.label}
                      onChange={(event) =>
                        updateOption("sizes", option.id, {
                          label: event.target.value,
                        })
                      }
                      className="min-w-[140px] flex-1"
                    />
                    <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={option.enabled}
                        onChange={(event) =>
                          updateOption("sizes", option.id, {
                            enabled: event.target.checked,
                          })
                        }
                      />
                      Actif
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs"
                        onClick={() => moveOption("sizes", index, "up")}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs"
                        onClick={() => moveOption("sizes", index, "down")}
                        disabled={index === optionConfig.sizes.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs text-red-600 dark:text-red-400"
                        onClick={() => removeOption("sizes", option.id)}
                      >
                        Retirer
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Aucune taille configurée.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Options personnalisées
            </p>
            <Button
              type="button"
              variant="secondary"
              className="min-h-8 px-2 py-1 text-xs"
              onClick={addOptionGroup}
            >
              Ajouter
            </Button>
          </div>
          <div className="space-y-3">
            {optionConfig.options.length ? (
              optionConfig.options.map((group, groupIndex) => (
                <div
                  key={group.id}
                  className="space-y-3 rounded-xl border border-dashed border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={group.name}
                      onChange={(event) =>
                        updateOptionGroup(group.id, {
                          name: event.target.value,
                        })
                      }
                      placeholder="Nom de l’option"
                      className="min-w-[160px] flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs"
                        onClick={() => moveOptionGroup(groupIndex, "up")}
                        disabled={groupIndex === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs"
                        onClick={() => moveOptionGroup(groupIndex, "down")}
                        disabled={groupIndex === optionConfig.options.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-8 px-2 py-1 text-xs text-red-600 dark:text-red-400"
                        onClick={() => removeOptionGroup(group.id)}
                      >
                        Retirer
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.values.length ? (
                      group.values.map((option, index) => (
                        <div
                          key={option.id}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <Input
                            value={option.label}
                            onChange={(event) =>
                              updateOptionGroupValue(group.id, option.id, {
                                label: event.target.value,
                              })
                            }
                            className="min-w-[140px] flex-1"
                          />
                          <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={option.enabled}
                              onChange={(event) =>
                                updateOptionGroupValue(group.id, option.id, {
                                  enabled: event.target.checked,
                                })
                              }
                            />
                            Actif
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              className="min-h-8 px-2 py-1 text-xs"
                              onClick={() =>
                                moveOptionGroupValue(group.id, index, "up")
                              }
                              disabled={index === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="min-h-8 px-2 py-1 text-xs"
                              onClick={() =>
                                moveOptionGroupValue(group.id, index, "down")
                              }
                              disabled={index === group.values.length - 1}
                            >
                              ↓
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="min-h-8 px-2 py-1 text-xs text-red-600 dark:text-red-400"
                              onClick={() =>
                                removeOptionGroupValue(group.id, option.id)
                              }
                            >
                              Retirer
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Aucune valeur configurée.
                      </p>
                    )}
                  </div>
                  <div className="flex">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-8 px-2 py-1 text-xs"
                      onClick={() => addOptionGroupValue(group.id)}
                    >
                      Ajouter une valeur
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Aucune option personnalisée.
              </p>
            )}
          </div>
        </div>
        {fieldErrors.optionConfig ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.optionConfig}
          </p>
        ) : null}
      </div>

      {(optionConfig.colors.length || optionConfig.sizes.length) ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Stock par variante
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Renseignez au moins une valeur pour activer le stock par variante.
            </p>
          </div>
          {optionConfig.colors.length && optionConfig.sizes.length ? (
            <div className="overflow-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-xs">
                <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  <tr>
                    <th className="px-3 py-2">Couleur</th>
                    {optionConfig.sizes.map((size) => (
                      <th key={size.id} className="px-3 py-2">
                        {size.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {optionConfig.colors.map((color) => (
                    <tr key={color.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-200">
                        {color.label}
                      </td>
                      {optionConfig.sizes.map((size) => {
                        const key = buildVariantKey(color.id, size.id);
                        return (
                          <td key={size.id} className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={variantStock[key] ?? ""}
                              onChange={(event) =>
                                setVariantStock((prev) => ({
                                  ...prev,
                                  [key]: event.target.value,
                                }))
                              }
                              className="h-8 text-xs"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(optionConfig.colors.length ? optionConfig.colors : optionConfig.sizes).map(
                (option) => {
                  const key = optionConfig.colors.length
                    ? buildVariantKey(option.id, null)
                    : buildVariantKey(null, option.id);
                  return (
                    <div key={option.id} className="space-y-1">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        {option.label}
                      </p>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={variantStock[key] ?? ""}
                        onChange={(event) =>
                          setVariantStock((prev) => ({
                            ...prev,
                            [key]: event.target.value,
                          }))
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  );
                },
              )}
            </div>
          )}
          {fieldErrors.variantStock ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.variantStock}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 space-y-2">
        <label htmlFor="quoteFormSchema" className="label">
          Schéma formulaire devis (JSON)
        </label>
        <Textarea
          id="quoteFormSchema"
          name="quoteFormSchema"
          rows={5}
          defaultValue={quoteFormSchemaValue}
          className="font-mono text-xs"
          aria-invalid={Boolean(fieldErrors.quoteFormSchema) || undefined}
          data-invalid={fieldErrors.quoteFormSchema ? "true" : undefined}
        />
        {fieldErrors.quoteFormSchema ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.quoteFormSchema}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <label htmlFor="priceHT" className="label">
            {`Prix HT (${currencyCode})`}
          </label>
          <Input
            id="priceHT"
            name="priceHT"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              defaultValues?.priceHTCents != null
                ? fromCents(defaultValues.priceHTCents, currencyCode)
                : ""
            }
            required
            aria-invalid={Boolean(fieldErrors.priceHTCents) || undefined}
            data-invalid={fieldErrors.priceHTCents ? "true" : undefined}
          />
          {fieldErrors.priceHTCents ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.priceHTCents}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="vatRate" className="label">
            Taux de TVA (%)
          </label>
          <Input
            id="vatRate"
            name="vatRate"
            type="number"
            min="0"
            step="0.5"
            defaultValue={defaultValues?.vatRate ?? 20}
            required
            aria-invalid={Boolean(fieldErrors.vatRate) || undefined}
            data-invalid={fieldErrors.vatRate ? "true" : undefined}
          />
          {fieldErrors.vatRate ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.vatRate}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="defaultDiscountRate" className="label">
            Remise par défaut (%)
          </label>
          <Input
            id="defaultDiscountRate"
            name="defaultDiscountRate"
            type="number"
            min="0"
            step="0.5"
            defaultValue={
              defaultValues?.defaultDiscountRate != null
                ? defaultValues.defaultDiscountRate
                : ""
            }
            aria-invalid={Boolean(fieldErrors.defaultDiscountRate) || undefined}
            data-invalid={
              fieldErrors.defaultDiscountRate ? "true" : undefined
            }
          />
          {fieldErrors.defaultDiscountRate ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.defaultDiscountRate}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <FormSubmitButton className="w-full sm:w-auto">
          {submitLabel}
        </FormSubmitButton>
      </div>
    </form>
  );
}
