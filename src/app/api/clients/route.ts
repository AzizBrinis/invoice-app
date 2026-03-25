import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import {
  getClientTenantId,
  listClients,
  type ClientFilters,
} from "@/server/clients";

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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 },
      );
    }
    ensureCanAccessAppSection(user, "clients");
    const tenantId = getClientTenantId(user);
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
    }, tenantId);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[api/clients] Failed to list clients", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les clients." },
      { status: 500 },
    );
  }
}
