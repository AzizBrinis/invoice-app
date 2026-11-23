import { handleLicenceStockRequest } from "@/server/digital-products/stock-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed server-to-server stock lookup used by the shop to decide whether a
 * product can be sold as "Livraison instantanée". Contract:
 * docs/DIGITAL_LICENCE_API.md ("Stock lookup").
 */
export async function POST(request: Request) {
  return handleLicenceStockRequest(request);
}

function methodNotAllowed() {
  return Response.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "Méthode non autorisée.", retryable: false } },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
