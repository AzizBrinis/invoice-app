import { NextResponse } from "next/server";
import { AccountPermission } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureHasAccountPermission } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";
import { generateClientPaymentReceiptPdf } from "@/server/pdf";
import { getClientPaymentReceipt } from "@/server/client-payments";

type PageParams = { id: string };
type RouteContext = { params: Promise<PageParams> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    ensureHasAccountPermission(
      user,
      AccountPermission.RECEIPTS_MANAGE,
      "Accès reçu refusé",
    );

    const resolvedParams = await params;
    const { snapshot } = await getClientPaymentReceipt(resolvedParams.id);
    const buffer = await generateClientPaymentReceiptPdf(resolvedParams.id);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="recu-${snapshot.receiptNumber}.pdf"`,
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
      { message: (error as Error).message ?? "Erreur de génération du reçu" },
      { status: 500 },
    );
  }
}
