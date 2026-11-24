import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageDigitalProducts } from "@/lib/authorization";
import { enforceRateLimit, PublicRequestSecurityError } from "@/lib/security/public-request";
import {
  LicenceOrderStateError,
  renderLicenceOrderPdf,
} from "@/server/digital-products/licences";
import { LicenceEncryptionConfigError } from "@/server/digital-products/licence-crypto";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A stolen session must not be able to export the whole licence history at once. */
const PDF_LIMIT_PER_MINUTE = 40;
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
  // Opening a licence marks its codes as used: never from another site.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ message: "Accès refusé" }, { status: 403, headers: NO_STORE });
  }
  try {
    enforceRateLimit({ key: `digital-licences:pdf:${user.id}`, limit: PDF_LIMIT_PER_MINUTE, windowMs: 60_000 });
  } catch (error) {
    if (!(error instanceof PublicRequestSecurityError)) throw error;
    console.warn("[digital-licences] pdf_rate_limited", { userId: user.id });
    return NextResponse.json(
      { message: "Trop de téléchargements. Réessayez dans une minute." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(error.retryAfterSeconds ?? 60) } },
    );
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
