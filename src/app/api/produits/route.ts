import { NextResponse } from "next/server";
import { listProducts } from "@/server/products";

function parseBooleanFilter(value: string | null) {
  if (!value || value === "all") {
    return "all" as const;
  }
  if (value === "actifs") {
    return true as const;
  }
  if (value === "inactifs") {
    return false as const;
  }
  return "all" as const;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("recherche") ?? undefined;
    const categorie =
      url.searchParams.get("categorie")?.toString() ?? "all";
    const statut = parseBooleanFilter(
      url.searchParams.get("statut"),
    );
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

    const data = await listProducts({
      search,
      category: categorie || "all",
      isActive: statut,
      page,
      pageSize,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/produits] GET failed", error);
    return NextResponse.json(
      { error: "Unable to load products" },
      { status: 500 },
    );
  }
}
