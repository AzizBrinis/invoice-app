"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { productSchema, createProduct, updateProduct, deleteProduct } from "@/server/products";
import { toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

function parseProductForm(formData: FormData) {
  const priceHT = Number(formData.get("priceHT") ?? 0);
  const vatRate = Number(formData.get("vatRate") ?? 0);
  const discountRateRaw = formData.get("defaultDiscountRate");
  const priceHTCents = toCents(priceHT);
  const priceTTCCents = Math.round(priceHTCents * (1 + vatRate / 100));

  const payload = {
    sku: formData.get("sku")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() || null,
    category: formData.get("category")?.toString() || null,
    unit: formData.get("unit")?.toString() || "unité",
    priceHTCents,
    priceTTCCents,
    vatRate,
    defaultDiscountRate:
      discountRateRaw && discountRateRaw.toString().length > 0
        ? Number(discountRateRaw)
        : null,
    isActive:
      (formData.get("isActive")?.toString() ?? "true").toLowerCase() !==
      "false",
  } satisfies Record<string, unknown>;

  return productSchema.parse(payload);
}

export async function createProductAction(formData: FormData) {
  const data = parseProductForm(formData);
  await createProduct(data);
  revalidatePath("/produits");
  redirect("/produits");
}

export async function updateProductAction(id: string, formData: FormData) {
  const data = parseProductForm(formData);
  await updateProduct(id, data);
  revalidatePath("/produits");
  redirect("/produits");
}

export async function deleteProductAction(id: string) {
  await deleteProduct(id);
  revalidatePath("/produits");
  redirect("/produits");
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

export async function importProductsAction(formData: FormData) {
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

  const entries: Array<{
    sku: string;
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

    const priceHTCents = toCents(priceHT);
    const priceTTCCents = Math.round(priceHTCents * (1 + vatRate / 100));
    const description = findValue(row, "description") || null;
    const categoryValue = findValue(row, "cat") || null;
    const unitValue =
      findValue(row, "unité") || findValue(row, "unite") || "unité";

    entries.push({
      sku,
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

  await prisma.$transaction(
    entries.map((entry) =>
      prisma.product.upsert({
        where: { sku: entry.sku },
        update: entry.data,
        create: {
          sku: entry.sku,
          ...entry.data,
        },
      }),
    ),
  );

  if (errors.length > 0) {
    console.warn(
      `[importProductsAction] Lignes ignorées lors de l'import : ${errors.join(
        ", ",
      )}`,
    );
  }

  revalidatePath("/produits");
  redirect("/produits");
}
