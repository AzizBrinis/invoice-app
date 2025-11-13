import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchQuoteProducts } from "@/server/quotes";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limitParam = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? limitParam : 20;
    const items = await searchQuoteProducts(user.id, query, limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[products.search] failed", error);
    return NextResponse.json(
      { message: "Impossible de récupérer les produits." },
      { status: 500 },
    );
  }
}
