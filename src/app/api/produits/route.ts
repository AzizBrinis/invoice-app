import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 },
      );
    }
    ensureCanAccessAppSection(user, "products");
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
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[api/produits] GET failed", error);
    return NextResponse.json(
      { error: "Unable to load products" },
      { status: 500 },
    );
  }
}
