import { NextResponse } from "next/server";
import { listWebsiteProductSummaries } from "@/server/website";

export const dynamic = "force-dynamic";

function parseVisibility(value: string | null) {
  if (value === "visible" || value === "hidden") {
    return value;
  }
  return "all" as const;
}

function parseBooleanFlag(value: string | null) {
  if (!value) return false;
  return value === "true" || value === "1" || value === "on";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const visibility = parseVisibility(url.searchParams.get("visibility"));
    const includeInactive = parseBooleanFlag(
      url.searchParams.get("inactive"),
    );
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "40");

    const data = await listWebsiteProductSummaries({
      search: q,
      visibility,
      includeInactive,
      page,
      pageSize,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/site-web/products] GET failed", error);
    return NextResponse.json(
      { error: "Impossible de charger les produits listés." },
      { status: 500 },
    );
  }
}
