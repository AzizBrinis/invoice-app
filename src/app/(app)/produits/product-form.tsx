"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { fromCents, toCents } from "@/lib/money";
import type { CurrencyCode } from "@/lib/currency";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast-provider";
import { generateId } from "@/lib/id";
import { slugify } from "@/lib/slug";
import {
  normalizeProductFaqItems,
  parseBulkProductFaqInput,
  PRODUCT_FAQ_ANSWER_MAX_LENGTH,
  PRODUCT_FAQ_MAX_ITEMS,
  PRODUCT_FAQ_QUESTION_MAX_LENGTH,
} from "@/lib/product-faq";
import { normalizeProductOptionConfig } from "@/lib/product-options";
import { buildProductImageAlt } from "@/lib/product-seo";
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
    shortDescriptionHtml?: string | null;
    excerpt?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    coverImageUrl?: string | null;
    gallery?: unknown | null;
    faqItems?: unknown | null;
    quoteFormSchema?: unknown | null;
    optionConfig?: unknown | null;
    variantStock?: unknown | null;
    category?: string | null;
    unit?: string;
    stockQuantity?: number | null;
    priceHTCents?: number;
    vatRate?: number;
    defaultDiscountRate?: number | null;
    defaultDiscountAmountCents?: number | null;
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

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

type FaqInputMode = "normal" | "bulk";

type OptionValue = {
  id: string;
  label: string;
  enabled: boolean;
  swatch?: string | null;
  priceAdjustment: string;
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
type DiscountType = "none" | "percentage" | "fixed";

type VariantStockMap = Record<string, string>;

const VARIANT_SEPARATOR = "::";
const SHORT_DESCRIPTION_HTML_LIMIT = 600;
const BULK_FAQ_TEMPLATE = `Question: Comment vais-je recevoir ma licence Microsoft Office 2021 ?
Réponse: Il s'agit d'un téléchargement numérique. Vous recevrez votre clé et les instructions d'activation par email après validation de la commande.

---
Question: La licence est-elle valable à vie ?
Réponse: Oui, il s'agit d'une licence perpétuelle pour 1 PC, sans abonnement annuel.`;

function buildVariantKey(colorId?: string | null, sizeId?: string | null) {
  return `${colorId ?? ""}${VARIANT_SEPARATOR}${sizeId ?? ""}`;
}

function normalizeGalleryItems(
  gallery: unknown,
  coverImageUrl?: string | null,
): GalleryItem[] {
  const entries: GalleryItem[] = [];
  if (Array.isArray(gallery)) {
    gallery.forEach((entry) => {
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

function normalizeFaqItems(value: unknown): FaqItem[] {
  return normalizeProductFaqItems(value).map((item, index) => ({
    id: generateId(`faq-${index + 1}`),
    question: item.question,
    answer: item.answer,
  }));
}

function hasFaqContent(item: Pick<FaqItem, "question" | "answer">) {
  return (
    item.question.trim().length > 0 || item.answer.trim().length > 0
  );
}

function cleanUploadedImageLabel(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDraftImageAlt(options: {
  fileName?: string | null;
  name?: string | null;
  category?: string | null;
  index?: number;
}) {
  const fileLabel = options.fileName
    ? cleanUploadedImageLabel(options.fileName)
    : "";

  return (
    fileLabel ||
    buildProductImageAlt({
      name: options.name,
      category: options.category,
      index: options.index,
    })
  );
}

function normalizeOptionConfig(
  value: unknown,
  currencyCode: CurrencyCode,
): OptionConfigState {
  const record = normalizeProductOptionConfig(value);
  const toStateValue = (entry: {
    id: string;
    label: string;
    enabled: boolean;
    swatch?: string | null;
    priceAdjustmentCents?: number | null;
  }): OptionValue => ({
    id: entry.id,
    label: entry.label,
    enabled: entry.enabled,
    swatch: entry.swatch ?? null,
    priceAdjustment:
      entry.priceAdjustmentCents != null
        ? String(fromCents(entry.priceAdjustmentCents, currencyCode))
        : "",
  });
  return {
    colors: record.colors.map(toStateValue),
    sizes: record.sizes.map(toStateValue),
    options: record.options.map((group) => ({
      id: group.id,
      name: group.name,
      values: group.values.map(toStateValue),
    })),
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

function parseMoneyInputToCents(
  value: string,
  currencyCode: CurrencyCode,
) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized.length) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return toCents(amount, currencyCode);
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
  const [productName, setProductName] = useState(defaultValues?.name ?? "");
  const [productCategory, setProductCategory] = useState(
    defaultValues?.category ?? "",
  );
  const [publicSlugValue, setPublicSlugValue] = useState(
    defaultValues?.publicSlug ?? "",
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
  const [faqItems, setFaqItems] = useState<FaqItem[]>(() =>
    normalizeFaqItems(defaultValues?.faqItems),
  );
  const [faqInputMode, setFaqInputMode] = useState<FaqInputMode>("normal");
  const [bulkFaqValue, setBulkFaqValue] = useState("");
  const [bulkFaqError, setBulkFaqError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [optionConfig, setOptionConfig] = useState<OptionConfigState>(() =>
    normalizeOptionConfig(defaultValues?.optionConfig, currencyCode),
  );
  const [variantStock, setVariantStock] = useState<VariantStockMap>(() =>
    normalizeVariantStockMap(defaultValues?.variantStock),
  );
  const [discountType, setDiscountType] = useState<DiscountType>(() => {
    if (defaultValues?.defaultDiscountAmountCents != null) {
      return "fixed";
    }
    if (defaultValues?.defaultDiscountRate != null) {
      return "percentage";
    }
    return "none";
  });
  const [discountValue, setDiscountValue] = useState(() => {
    if (defaultValues?.defaultDiscountAmountCents != null) {
      return String(
        fromCents(defaultValues.defaultDiscountAmountCents, currencyCode),
      );
    }
    if (defaultValues?.defaultDiscountRate != null) {
      return String(defaultValues.defaultDiscountRate);
    }
    return "";
  });

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
  const suggestedSlug = useMemo(
    () => slugify(productName) || slugify(productCategory),
    [productCategory, productName],
  );
  const resolvedSlugPreview = publicSlugValue.trim() || suggestedSlug;

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

  const faqItemsPayload = useMemo(() => {
    const payload = faqItems
      .map((item) => ({
        question: item.question.trim(),
        answer: item.answer.trim(),
      }))
      .filter((item) => item.question.length > 0 || item.answer.length > 0);
    if (!payload.length) return "";
    return JSON.stringify(payload);
  }, [faqItems]);
  const filledFaqCount = useMemo(
    () => faqItems.filter((item) => hasFaqContent(item)).length,
    [faqItems],
  );
  const remainingFaqSlots = Math.max(
    0,
    PRODUCT_FAQ_MAX_ITEMS - filledFaqCount,
  );

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
    const serializeValue = (value: OptionValue) => ({
      id: value.id,
      label: value.label,
      enabled: value.enabled,
      swatch: value.swatch ?? null,
      priceAdjustmentCents: parseMoneyInputToCents(
        value.priceAdjustment,
        currencyCode,
      ),
    });
    return JSON.stringify({
      colors: optionConfig.colors.map(serializeValue),
      sizes: optionConfig.sizes.map(serializeValue),
      options: optionConfig.options.map((group) => ({
        id: group.id,
        name: group.name,
        values: group.values.map(serializeValue),
      })),
    });
  }, [optionConfig, currencyCode]);

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
        uploads.push({
          ...processed,
          alt: buildDraftImageAlt({
            fileName: file.name,
            name: productName,
            category: productCategory,
            index: galleryItems.length + uploads.length,
          }),
        });
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
          alt: buildDraftImageAlt({
            name: productName,
            category: productCategory,
            index: prev.length,
          }),
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

  function updatePhotoAlt(targetId: string, alt: string) {
    setGalleryItems((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, alt } : item,
      ),
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

  function addFaqItem() {
    setFaqItems((prev) => {
      if (prev.length >= PRODUCT_FAQ_MAX_ITEMS) return prev;
      return [
        ...prev,
        {
          id: generateId("faq"),
          question: "",
          answer: "",
        },
      ];
    });
  }

  function updateFaqItem(
    targetId: string,
    changes: Partial<Pick<FaqItem, "question" | "answer">>,
  ) {
    setFaqItems((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, ...changes } : item,
      ),
    );
  }

  function moveFaqItem(index: number, direction: "up" | "down") {
    setFaqItems((prev) => {
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const current = next[index];
      next[index] = next[swapIndex];
      next[swapIndex] = current;
      return next;
    });
  }

  function removeFaqItem(targetId: string) {
    setFaqItems((prev) => prev.filter((item) => item.id !== targetId));
  }

  function importBulkFaqItems() {
    const existingQuestions = faqItems
      .filter((item) => hasFaqContent(item))
      .map((item) => item.question);
    const result = parseBulkProductFaqInput(bulkFaqValue, {
      existingCount: filledFaqCount,
      existingQuestions,
      maxItems: PRODUCT_FAQ_MAX_ITEMS,
    });

    if (!result.success) {
      setBulkFaqError(result.error);
      return;
    }

    setFaqItems((prev) => [
      ...prev.filter((item) => hasFaqContent(item)),
      ...result.items.map((item) => ({
        id: generateId("faq"),
        question: item.question,
        answer: item.answer,
      })),
    ]);
    setBulkFaqValue("");
    setBulkFaqError(null);
    setFaqInputMode("normal");
    addToast({
      variant: "success",
      title:
        result.items.length > 1
          ? `${result.items.length} FAQs ajoutées`
          : "1 FAQ ajoutée",
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
        priceAdjustment: "",
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
        priceAdjustment: "",
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
      <input type="hidden" name="faqItems" value={faqItemsPayload} />
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
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
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
            value={publicSlugValue}
            onChange={(event) => setPublicSlugValue(event.target.value)}
            placeholder={suggestedSlug || "ex: audit-croissance"}
            maxLength={80}
            aria-invalid={Boolean(fieldErrors.publicSlug) || undefined}
            data-invalid={fieldErrors.publicSlug ? "true" : undefined}
          />
          {fieldErrors.publicSlug ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.publicSlug}
            </p>
          ) : null}
          <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <p>
              Laissez vide pour générer un slug depuis le nom du produit.
            </p>
            {resolvedSlugPreview ? (
              <p>
                URL estimée : <span className="font-mono">/produit/{resolvedSlugPreview}</span>
              </p>
            ) : null}
            {suggestedSlug && publicSlugValue.trim() !== suggestedSlug ? (
              <button
                type="button"
                className="font-medium text-blue-600 transition hover:underline dark:text-blue-400"
                onClick={() => setPublicSlugValue(suggestedSlug)}
              >
                Utiliser la suggestion SEO : {suggestedSlug}
              </button>
            ) : null}
          </div>
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
          maxLength={280}
          defaultValue={defaultValues?.excerpt ?? ""}
          aria-invalid={Boolean(fieldErrors.excerpt) || undefined}
          data-invalid={fieldErrors.excerpt ? "true" : undefined}
        />
        {fieldErrors.excerpt ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.excerpt}
          </p>
        ) : null}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Résumé court utile pour les aperçus catalogue et les extraits SEO.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="shortDescriptionHtml" className="label">
          Description courte (HTML)
        </label>
        <Textarea
          id="shortDescriptionHtml"
          name="shortDescriptionHtml"
          rows={4}
          maxLength={SHORT_DESCRIPTION_HTML_LIMIT}
          defaultValue={defaultValues?.shortDescriptionHtml ?? ""}
          className="font-mono text-xs"
          aria-invalid={Boolean(fieldErrors.shortDescriptionHtml) || undefined}
          data-invalid={fieldErrors.shortDescriptionHtml ? "true" : undefined}
        />
        {fieldErrors.shortDescriptionHtml ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.shortDescriptionHtml}
          </p>
        ) : null}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Résumé concis utilisé sur la fiche produit. HTML autorisé,
          {` ${SHORT_DESCRIPTION_HTML_LIMIT} caractères max.`}
        </p>
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
            maxLength={160}
            defaultValue={defaultValues?.metaTitle ?? ""}
            aria-invalid={Boolean(fieldErrors.metaTitle) || undefined}
            data-invalid={fieldErrors.metaTitle ? "true" : undefined}
          />
          {fieldErrors.metaTitle ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.metaTitle}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Recommandé : 50 à 65 caractères avec le nom du produit et le terme clé principal.
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="metaDescription" className="label">
            Meta description
          </label>
          <Textarea
            id="metaDescription"
            name="metaDescription"
            rows={3}
            maxLength={260}
            defaultValue={defaultValues?.metaDescription ?? ""}
            aria-invalid={Boolean(fieldErrors.metaDescription) || undefined}
            data-invalid={fieldErrors.metaDescription ? "true" : undefined}
          />
          {fieldErrors.metaDescription ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.metaDescription}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Recommandé : 140 à 160 caractères, avec bénéfice produit et contexte local si pertinent.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              FAQ produit
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ajoutez des réponses utiles pour les clients et les résultats enrichis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={faqInputMode === "normal" ? "primary" : "secondary"}
              className="min-h-8 px-2 py-1 text-xs"
              onClick={() => {
                setFaqInputMode("normal");
                setBulkFaqError(null);
              }}
            >
              Mode normal
            </Button>
            <Button
              type="button"
              variant={faqInputMode === "bulk" ? "primary" : "secondary"}
              className="min-h-8 px-2 py-1 text-xs"
              onClick={() => {
                setFaqInputMode("bulk");
                setBulkFaqError(null);
              }}
            >
              Ajout rapide
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <p>
            {filledFaqCount}/{PRODUCT_FAQ_MAX_ITEMS} FAQs prêtes pour la fiche
            produit et le JSON-LD.
          </p>
          <p>
            {remainingFaqSlots > 0
              ? `${remainingFaqSlots} emplacement${remainingFaqSlots > 1 ? "s" : ""} restant${remainingFaqSlots > 1 ? "s" : ""}.`
              : "Limite atteinte."}
          </p>
        </div>
        {faqInputMode === "bulk" ? (
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Coller plusieurs FAQs
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Utilisez le format <span className="font-mono">Question:</span> puis <span className="font-mono">Réponse:</span>. Séparez chaque bloc avec <span className="font-mono">---</span>. Les FAQs importées deviennent ensuite modifiables ligne par ligne.
              </p>
            </div>
            <Textarea
              rows={10}
              value={bulkFaqValue}
              onChange={(event) => {
                setBulkFaqValue(event.target.value);
                if (bulkFaqError) {
                  setBulkFaqError(null);
                }
              }}
              placeholder={BULK_FAQ_TEMPLATE}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-8 px-2 py-1 text-xs"
                onClick={() => {
                  setBulkFaqValue(BULK_FAQ_TEMPLATE);
                  setBulkFaqError(null);
                }}
              >
                Insérer un exemple
              </Button>
              <Button
                type="button"
                className="min-h-8 px-2 py-1 text-xs"
                onClick={importBulkFaqItems}
                disabled={remainingFaqSlots === 0}
              >
                Importer dans la liste
              </Button>
            </div>
            {bulkFaqError ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {bulkFaqError}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Ordre, question et réponse sont repris tels quels pour le rendu public.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="min-h-8 px-2 py-1 text-xs"
            onClick={addFaqItem}
            disabled={faqItems.length >= PRODUCT_FAQ_MAX_ITEMS}
          >
            Ajouter une question
          </Button>
        </div>
        {faqItems.length ? (
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <div
                key={item.id}
                className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                    FAQ {index + 1}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-8 px-2 py-1 text-xs"
                      onClick={() => moveFaqItem(index, "up")}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-8 px-2 py-1 text-xs"
                      onClick={() => moveFaqItem(index, "down")}
                      disabled={index === faqItems.length - 1}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-8 px-2 py-1 text-xs text-red-600 dark:text-red-400"
                      onClick={() => removeFaqItem(item.id)}
                    >
                      Retirer
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label" htmlFor={`faq-question-${item.id}`}>
                    Question
                  </label>
                  <Input
                    id={`faq-question-${item.id}`}
                    value={item.question}
                    maxLength={PRODUCT_FAQ_QUESTION_MAX_LENGTH}
                    onChange={(event) =>
                      updateFaqItem(item.id, {
                        question: event.target.value,
                      })
                    }
                    placeholder="Ex: Quels sont les délais de livraison en Tunisie ?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="label" htmlFor={`faq-answer-${item.id}`}>
                    Réponse
                  </label>
                  <Textarea
                    id={`faq-answer-${item.id}`}
                    rows={3}
                    maxLength={PRODUCT_FAQ_ANSWER_MAX_LENGTH}
                    value={item.answer}
                    onChange={(event) =>
                      updateFaqItem(item.id, {
                        answer: event.target.value,
                      })
                    }
                    placeholder="Réponse claire, utile et rédigée pour les clients."
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Aucune FAQ produit configurée pour le moment.
          </p>
        )}
        {fieldErrors.faqItems ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {fieldErrors.faqItems}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0 space-y-2">
          <label htmlFor="category" className="label">
            Catégorie
          </label>
          <Input
            id="category"
            name="category"
            value={productCategory}
            onChange={(event) => setProductCategory(event.target.value)}
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
                      alt={buildProductImageAlt({
                        explicitAlt: item.alt,
                        name: productName,
                        category: productCategory,
                        index,
                      })}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor={`gallery-alt-${item.id}`}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
                    >
                      Texte alternatif
                    </label>
                    <Input
                      id={`gallery-alt-${item.id}`}
                      value={item.alt}
                      maxLength={160}
                      onChange={(event) =>
                        updatePhotoAlt(item.id, event.target.value)
                      }
                      placeholder={buildProductImageAlt({
                        name: productName,
                        category: productCategory,
                        index,
                      })}
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Décrivez l’image avec le nom du produit, sans bourrage de mots-clés.
                    </p>
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
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Options personnalisées
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Chaque valeur peut ajuster le prix de base. Utilisez un montant
                négatif pour diminuer le prix.
              </p>
            </div>
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
                          <Input
                            type="number"
                            step="0.01"
                            value={option.priceAdjustment}
                            onChange={(event) =>
                              updateOptionGroupValue(group.id, option.id, {
                                priceAdjustment: event.target.value,
                              })
                            }
                            placeholder={`0.00 ${currencyCode}`}
                            className="w-full sm:w-40"
                            aria-label={`Ajustement prix pour ${option.label}`}
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

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
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
          <label htmlFor="defaultDiscountType" className="label">
            Type de remise
          </label>
          <select
            id="defaultDiscountType"
            name="defaultDiscountType"
            className="input"
            value={discountType}
            onChange={(event) => {
              const nextType = event.target.value as DiscountType;
              setDiscountType(nextType);
              if (nextType === "none") {
                setDiscountValue("");
              }
            }}
          >
            <option value="none">Aucune</option>
            <option value="percentage">Pourcentage (%)</option>
            <option value="fixed">Montant fixe</option>
          </select>
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="defaultDiscountValue" className="label">
            Valeur de remise
          </label>
          <Input
            id="defaultDiscountValue"
            name="defaultDiscountValue"
            type="number"
            min="0"
            step="0.01"
            value={discountValue}
            onChange={(event) => setDiscountValue(event.target.value)}
            disabled={discountType === "none"}
            placeholder={
              discountType === "fixed" ? `0.00 ${currencyCode}` : "0"
            }
            aria-invalid={Boolean(fieldErrors.defaultDiscount) || undefined}
            data-invalid={fieldErrors.defaultDiscount ? "true" : undefined}
          />
          {fieldErrors.defaultDiscount ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {fieldErrors.defaultDiscount}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Choisissez une remise en pourcentage ou un montant fixe.
          </p>
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
