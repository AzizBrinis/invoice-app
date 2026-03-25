import { NextResponse } from "next/server";
import { generateInvoicePdf } from "@/server/pdf";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";

type PageParams = { id: string };
type RouteContext = { params: Promise<PageParams> };

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentification requise" },
        { status: 401 },
      );
    }

    ensureCanAccessAppSection(user, "invoices");

    const resolvedParams = await params;
    const buffer = await generateInvoicePdf(resolvedParams.id);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-${resolvedParams.id}.pdf"`,
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
      { message: (error as Error).message ?? "Erreur de génération du PDF" },
      { status: 500 },
    );
  }
}
