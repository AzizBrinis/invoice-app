"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { Prisma } from "@/lib/db/prisma-server";
import { productSchema, createProduct, updateProduct, deleteProduct } from "@/server/products";
import { buildProductFormValidationState } from "@/server/product-form-errors";
import { toCents } from "@/lib/money";
import { prisma } from "@/lib/db";
import { getSettings } from "@/server/settings";
import { requireUser } from "@/lib/auth";
import { requireAppSectionAccess } from "@/lib/authorization";
import type { ProductFormState } from "@/app/(app)/produits/form-state";
import { isRedirectError } from "@/lib/next";
import type { Route } from "next";

function parseOptionalJsonField(formData: FormData, fieldName: string) {
  const raw = formData.get(fieldName);
  if (!raw) {
    return null;
  }
  const value = raw.toString().trim();
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new ZodError([
      {
        code: "custom",
        path: [fieldName],
        message: "JSON invalide.",
      },
    ]);
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function parseProductForm(formData: FormData, currency: string) {
  const priceHT = Number(formData.get("priceHT") ?? 0);
  const vatRate = Number(formData.get("vatRate") ?? 0);
  const discountType =
    formData.get("defaultDiscountType")?.toString() ?? "none";
  const discountValueRaw =
    formData.get("defaultDiscountValue")?.toString().trim() ?? "";
  const normalizedDiscountValue = discountValueRaw.replace(",", ".");
  const parsedDiscountValue = normalizedDiscountValue.length
    ? Number(normalizedDiscountValue)
    : null;
  const priceHTCents = toCents(priceHT, currency);
  const priceTTCCents = Math.round(priceHTCents * (1 + vatRate / 100));
  const publicSlugRaw = formData.get("publicSlug")?.toString().trim() ?? "";
  const publicSlug = publicSlugRaw.length > 0 ? publicSlugRaw : undefined;
  const excerptRaw = formData.get("excerpt")?.toString().trim();
  const metaTitleRaw = formData.get("metaTitle")?.toString().trim();
  const metaDescriptionRaw = formData.get("metaDescription")?.toString().trim();
  const coverImageUrlRaw = formData.get("coverImageUrl")?.toString().trim();
  const gallery = parseOptionalJsonField(formData, "gallery");
  const faqItems = parseOptionalJsonField(formData, "faqItems");
  const quoteFormSchema = parseOptionalJsonField(formData, "quoteFormSchema");
  const optionConfig = parseOptionalJsonField(formData, "optionConfig");
  const variantStock = parseOptionalJsonField(formData, "variantStock");
  const descriptionHtmlRaw = formData.get("descriptionHtml")?.toString();
  const shortDescriptionHtmlRaw =
    formData.get("shortDescriptionHtml")?.toString();
  const stockQuantityRaw = formData.get("stockQuantity")?.toString();
  const stockQuantity =
    stockQuantityRaw && stockQuantityRaw.trim().length > 0
      ? Number(stockQuantityRaw)
      : null;

  const payload = {
    sku: formData.get("sku")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    saleMode: formData.get("saleMode")?.toString() ?? "INSTANT",
    publicSlug,
    description: formData.get("description")?.toString() || null,
    descriptionHtml: descriptionHtmlRaw ?? null,
    shortDescriptionHtml: shortDescriptionHtmlRaw ?? null,
    excerpt: excerptRaw && excerptRaw.length > 0 ? excerptRaw : null,
    metaTitle: metaTitleRaw && metaTitleRaw.length > 0 ? metaTitleRaw : null,
    metaDescription:
      metaDescriptionRaw && metaDescriptionRaw.length > 0
        ? metaDescriptionRaw
        : null,
    coverImageUrl:
      coverImageUrlRaw && coverImageUrlRaw.length > 0
        ? coverImageUrlRaw
        : null,
    gallery,
    faqItems,
    quoteFormSchema,
    optionConfig,
    variantStock,
    category: formData.get("category")?.toString() || null,
    unit: formData.get("unit")?.toString() || "unité",
    stockQuantity,
    priceHTCents,
    priceTTCCents,
    vatRate,
    defaultDiscountRate:
      discountType === "percentage" && parsedDiscountValue !== null
        ? parsedDiscountValue
        : null,
    defaultDiscountAmountCents:
      discountType === "fixed" && parsedDiscountValue !== null
        ? toCents(parsedDiscountValue, currency)
        : null,
    isActive:
      (formData.get("isActive")?.toString() ?? "true").toLowerCase() !==
      "false",
    isListedInCatalog:
      (formData.get("isListedInCatalog")?.toString() ?? "true").toLowerCase() !==
      "false",
  } satisfies Record<string, unknown>;

  return productSchema.parse(payload);
}

function isUniqueConstraintError(error: unknown, field: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (Array.isArray(target)) {
        return target.includes(field);
      }
      if (typeof target === "string") {
        return target.includes(field);
      }
    }
  }
  if (typeof error === "object" && error !== null) {
    const maybe = error as { code?: string; meta?: { target?: unknown } };
    if (maybe.code === "P2002") {
      const target = maybe.meta?.target;
      if (Array.isArray(target)) {
        return target.includes(field);
      }
      if (typeof target === "string") {
        return target.includes(field);
      }
    }
  }
  return false;
}

function resolveRedirectTarget(
  formData: FormData | undefined,
  fallback: string,
) {
  const redirectTo = formData?.get("redirectTo")?.toString();
  if (redirectTo && redirectTo.startsWith("/")) {
    return redirectTo;
  }
  return fallback;
}

function redirectWithFeedback(
  target: string,
  feedback: { message?: string; error?: string; warning?: string },
): never {
  const [path, query = ""] = target.split("?");
  const params = new URLSearchParams(query);
  ["message", "error", "warning", "flash"].forEach((key) => {
    params.delete(key);
  });
  if (feedback.message) params.set("message", feedback.message);
  if (feedback.error) params.set("error", feedback.error);
  if (feedback.warning) params.set("warning", feedback.warning);
  if (feedback.message || feedback.error || feedback.warning) {
    params.set("flash", randomUUID());
  }
  const nextQuery = params.toString();
  const href = (nextQuery ? `${path}?${nextQuery}` : path) as Route;
  return redirect(href);
}

async function requireProductsAccess() {
  return requireAppSectionAccess("products");
}

export async function submitProductFormAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  try {
    await requireProductsAccess();
    const productId = formData.get("productId")?.toString() || undefined;
    const settings = await getSettings();
    const data = await parseProductForm(formData, settings.defaultCurrency);

    if (productId) {
      const updated = await updateProduct(productId, data);
      revalidatePath("/produits");
      revalidatePath("/catalogue");
      return {
        status: "success",
        message: "Produit mis à jour",
        productId: updated.id,
      };
    }

    const created = await createProduct(data);
    revalidatePath("/produits");
    revalidatePath("/catalogue");
    return {
      status: "success",
      message: "Produit créé",
      productId: created.id,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationState = buildProductFormValidationState(error);
      console.error("[submitProductFormAction] Validation failed", error.issues);
      return {
        status: "error",
        message: validationState.message,
        fieldErrors: validationState.fieldErrors,
      };
    }

    if (isUniqueConstraintError(error, "sku")) {
      return {
        status: "error",
        message: "Impossible d'enregistrer le produit. Vérifiez les champs.",
        fieldErrors: {
          sku: "Ce SKU est déjà utilisé.",
        },
      };
    }
    if (isUniqueConstraintError(error, "publicSlug")) {
      return {
        status: "error",
        message: "Impossible d'enregistrer le produit. Vérifiez les champs.",
        fieldErrors: {
          publicSlug: "Ce slug est déjà utilisé.",
        },
      };
    }

    if (isRedirectError(error)) {
      throw error;
    }

    console.error("[submitProductFormAction] Unexpected error", error);
    return {
      status: "error",
      message: "Une erreur inattendue est survenue. Veuillez réessayer.",
    };
  }
}

export async function createProductAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/produits");
  try {
    await requireProductsAccess();
    const settings = await getSettings();
    const data = await parseProductForm(formData, settings.defaultCurrency);
    await createProduct(data);
    revalidatePath("/produits");
    revalidatePath("/catalogue");
    redirectWithFeedback(redirectTarget, {
      message: "Produit créé",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[createProductAction] Échec de création de produit", error);
    let message = "Impossible de créer le produit.";
    if (error instanceof ZodError) {
      message = "Informations produit invalides.";
    } else if (isUniqueConstraintError(error, "sku")) {
      message = "Ce SKU est déjà utilisé.";
    } else if (isUniqueConstraintError(error, "publicSlug")) {
      message = "Ce slug est déjà utilisé.";
    }
    redirectWithFeedback(redirectTarget, {
      error: message,
    });
  }
}

export async function updateProductAction(id: string, formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/produits");
  try {
    await requireProductsAccess();
    const settings = await getSettings();
    const data = await parseProductForm(formData, settings.defaultCurrency);
    await updateProduct(id, data);
    revalidatePath("/produits");
    revalidatePath("/catalogue");
    redirectWithFeedback(redirectTarget, {
      message: "Produit mis à jour",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[updateProductAction] Échec de mise à jour", error);
    let message = "Impossible de mettre à jour le produit.";
    if (error instanceof ZodError) {
      message = "Informations produit invalides.";
    } else if (isUniqueConstraintError(error, "sku")) {
      message = "Ce SKU est déjà utilisé.";
    } else if (isUniqueConstraintError(error, "publicSlug")) {
      message = "Ce slug est déjà utilisé.";
    }
    redirectWithFeedback(redirectTarget, {
      error: message,
    });
  }
}

export async function deleteProductAction(id: string, formData?: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/produits");
  try {
    await requireProductsAccess();
    await deleteProduct(id);
    revalidatePath("/produits");
    revalidatePath("/catalogue");
    redirectWithFeedback(redirectTarget, {
      message: "Produit supprimé avec succès",
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteProductAction] Échec de suppression", error);
    redirectWithFeedback(redirectTarget, {
      error: "Impossible de supprimer ce produit.",
    });
  }
}

export async function deleteProductInlineAction(id: string) {
  try {
    await requireProductsAccess();
    await deleteProduct(id);
    revalidatePath("/produits");
    revalidatePath("/catalogue");
    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("[deleteProductInlineAction] Échec de suppression", error);
    return {
      success: false,
      error: "Impossible de supprimer ce produit.",
    };
  }
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

export async function importProductsAction(formData: FormData) {
  const redirectTarget = resolveRedirectTarget(formData, "/produits");

  try {
    await requireProductsAccess();
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Fichier CSV manquant");
    }
    const content = await file.text();
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new Error("CSV vide");
    }
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0]
      .split(delimiter)
      .map(normalizeHeader);

    const required = ["sku", "nom", "prix ht", "tva"];
    required.forEach((header) => {
      if (!headers.some((h) => h.includes(header))) {
        throw new Error(`Colonne requise manquante: ${header}`);
      }
    });

    const findValue = (row: string[], key: string) => {
      const index = headers.findIndex((header) => header.includes(key));
      return index >= 0 ? row[index]?.trim() ?? "" : "";
    };

    const settings = await getSettings(user.id);
    const currency = settings.defaultCurrency;

    const entries: Array<{
      sku: string;
      publicSlug: string;
      data: {
        name: string;
        description: string | null;
        category: string | null;
        unit: string;
        priceHTCents: number;
        priceTTCCents: number;
        vatRate: number;
        defaultDiscountRate: number | null;
        isActive: boolean;
      };
    }> = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const row = lines[i].split(delimiter);
      const sku = findValue(row, "sku");
      const name = findValue(row, "nom");
      if (!sku || !name) continue;

    const rowNumber = i + 1;
    const priceHTRaw = findValue(row, "prix ht").replace(",", ".");
    const vatRateRaw = findValue(row, "tva").replace(",", ".");
    const discountRaw = findValue(row, "remise").replace(",", ".");

    const priceHT = Number(priceHTRaw);
    const vatRate = Number(vatRateRaw);
    const discountRate =
      discountRaw.length > 0 ? Number(discountRaw) : null;

    if (!Number.isFinite(priceHT) || priceHT < 0) {
      errors.push(`ligne ${rowNumber}: prix HT invalide`);
      continue;
    }

    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      errors.push(`ligne ${rowNumber}: TVA invalide`);
      continue;
    }

    if (
      discountRate !== null &&
      (!Number.isFinite(discountRate) ||
        discountRate < 0 ||
        discountRate > 100)
    ) {
      errors.push(`ligne ${rowNumber}: remise invalide`);
      continue;
    }

    const priceHTCents = toCents(priceHT, currency);
    const priceTTCCents = Math.round(priceHTCents * (1 + vatRate / 100));
    const description = findValue(row, "description") || null;
    const categoryValue = findValue(row, "cat") || null;
    const unitValue =
      findValue(row, "unité") || findValue(row, "unite") || "unité";

    const publicSlugBase =
      slugify(sku) ||
      slugify(name) ||
      `product-${randomUUID().slice(0, 8)}`;

    entries.push({
      sku,
      publicSlug: publicSlugBase,
      data: {
        name,
        description,
        category: categoryValue && categoryValue.length > 0 ? categoryValue : null,
        unit: unitValue,
        priceHTCents,
        priceTTCCents,
        vatRate,
        defaultDiscountRate: discountRate,
        isActive: true,
      },
    });
    }

    if (entries.length === 0) {
      const message =
        errors.length > 0
          ? `Aucune ligne valide traitée (${errors.join(", ")})`
          : "Aucune ligne valide trouvée dans le fichier CSV.";
      throw new Error(message);
    }

    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.product.upsert({
          where: {
            userId_sku: {
              userId: user.id,
              sku: entry.sku,
            },
          },
          update: entry.data,
          create: {
            userId: user.id,
            sku: entry.sku,
            publicSlug: entry.publicSlug,
            ...entry.data,
          },
        });
      }
    });

    if (errors.length > 0) {
      console.warn(
        `[importProductsAction] Lignes ignorées lors de l'import : ${errors.join(
          ", ",
        )}`,
      );
    }

    revalidatePath("/produits");
    revalidatePath("/catalogue");
    redirectWithFeedback(redirectTarget, {
      message: `Import terminé (${entries.length} produit(s))`,
      warning:
        errors.length > 0
          ? `${errors.length} ligne(s) ignorée(s) lors de l'import.`
          : undefined,
    });
  } catch (error) {
    console.error("[importProductsAction] Échec d'import CSV", error);
    redirectWithFeedback(redirectTarget, {
      error: "Import impossible. Vérifiez votre fichier CSV.",
    });
  }
}
