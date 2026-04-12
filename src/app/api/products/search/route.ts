import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { getQuoteTenantId, searchQuoteProducts } from "@/server/quotes";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentification requise." },
        { status: 401 },
      );
    }
    ensureCanAccessAppSection(user, "quotes");
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limitParam = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? limitParam : 20;
    const items = await searchQuoteProducts(getQuoteTenantId(user), query, limit);
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    console.error("[products.search] failed", error);
    return NextResponse.json(
      { message: "Impossible de récupérer les produits." },
      { status: 500 },
    );
  }
}
