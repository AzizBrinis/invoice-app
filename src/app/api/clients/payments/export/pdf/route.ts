import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { parseClientPaymentFilters } from "@/lib/client-payment-filters";
import { getClientTenantId } from "@/server/clients";
import { generateClientPaymentsReportPdfForUser } from "@/server/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentification requise" },
        { status: 401 },
      );
    }

    ensureCanAccessAppSection(user, "payments");

    const tenantId = getClientTenantId(user);
    const { searchParams } = new URL(request.url);
    const filters = parseClientPaymentFilters(searchParams);
    const buffer = await generateClientPaymentsReportPdfForUser(tenantId, {
      clientId: filters.clientId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: filters.search,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="rapport-paiements-clients.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { message: (error as Error).message ?? "Impossible de générer l’export PDF." },
      { status: 500 },
    );
  }
}
