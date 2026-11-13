import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageDigitalProducts } from "@/lib/authorization";
import {
  LicenceOrderStateError,
  renderLicenceOrderPdf,
} from "@/server/digital-products/licences";
import { LicenceEncryptionConfigError } from "@/server/digital-products/licence-crypto";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
};

/** Admin-only download of a licence PDF (only the codes of this licence). */
export async function GET(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Authentification requise" }, { status: 401, headers: NO_STORE });
  }
  if (!canManageDigitalProducts(user)) {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403, headers: NO_STORE });
  }
  const { id } = await params;
  if (!/^dlord-[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ message: "Licence introuvable" }, { status: 404, headers: NO_STORE });
  }
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const inline = new URL(request.url).searchParams.get("disposition") === "inline";

  try {
    const { pdf, filename } = await renderLicenceOrderPdf({
      tenantId,
      orderId: id,
      actor: `user:${user.id}`,
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof LicenceOrderStateError) {
      return NextResponse.json({ message: error.message }, { status: 409, headers: NO_STORE });
    }
    if (error instanceof LicenceEncryptionConfigError) {
      return NextResponse.json({ message: error.message }, { status: 503, headers: NO_STORE });
    }
    console.error("[digital-licences] pdf_route_failed", {
      orderId: id,
      error: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      { message: "Erreur de génération du PDF" },
      { status: 500, headers: NO_STORE },
    );
  }
}
