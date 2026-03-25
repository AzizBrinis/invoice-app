import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { getClientTenantId } from "@/server/clients";
import { searchPaymentServicePickerOptions } from "@/server/client-payments";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentification requise." },
        { status: 401 },
      );
    }

    ensureCanAccessAppSection(user, "payments");

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limitParam = Number(searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitParam) ? limitParam : 10;
    const items = await searchPaymentServicePickerOptions(
      getClientTenantId(user),
      query,
      limit,
    );

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

    console.error("[payment-services.search] failed", error);
    return NextResponse.json(
      { message: "Impossible de rechercher les services." },
      { status: 500 },
    );
  }
}
