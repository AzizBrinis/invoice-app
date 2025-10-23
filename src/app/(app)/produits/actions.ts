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

  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i].split(delimiter);
    const sku = findValue(row, "sku");
    const name = findValue(row, "nom");
    if (!sku || !name) continue;

    const priceHT = Number(findValue(row, "prix ht").replace(",", "."));
    const vatRate = Number(findValue(row, "tva").replace(",", "."));
    const discountRaw = findValue(row, "remise");
    const discountRate = discountRaw ? Number(discountRaw.replace(",", ".")) : null;
    const priceHTCents = toCents(priceHT);
    const priceTTCCents = Math.round(priceHTCents * (1 + vatRate / 100));

    await prisma.product.upsert({
      where: { sku },
      update: {
        name,
        description: findValue(row, "description") || null,
        category: findValue(row, "cat"),
        unit: findValue(row, "unité") || findValue(row, "unite") || "unité",
        priceHTCents,
        priceTTCCents,
        vatRate,
        defaultDiscountRate: discountRate,
        isActive: true,
      },
      create: {
        sku,
        name,
        description: findValue(row, "description") || null,
        category: findValue(row, "cat") || null,
        unit: findValue(row, "unité") || findValue(row, "unite") || "unité",
        priceHTCents,
        priceTTCCents,
        vatRate,
        defaultDiscountRate: discountRate,
        isActive: true,
      },
    });
  }

  revalidatePath("/produits");
  redirect("/produits");
}
