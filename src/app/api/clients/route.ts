import { type NextRequest, NextResponse } from "next/server";
import { listClients, type ClientFilters } from "@/server/clients";

function parseStatusFilter(
  value: string | null,
): ClientFilters["isActive"] {
  if (!value || value === "all") return "all";
  if (value === "actifs") return true;
  if (value === "inactifs") return false;
  return "all";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search")?.slice(0, 120) || undefined;
    const statusValue = searchParams.get("status");
    const isActive = parseStatusFilter(statusValue);
    const page = Number(searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(searchParams.get("pageSize") ?? "20") || 20;

    const result = await listClients({
      search,
      isActive,
      page,
      pageSize,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/clients] Failed to list clients", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les clients." },
      { status: 500 },
    );
  }
}
