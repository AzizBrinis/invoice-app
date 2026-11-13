import { handleLicenceApiRequest } from "@/server/digital-products/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Signed server-to-server endpoint that allocates activation codes and
 * returns the licence PDF. Contract: docs/DIGITAL_LICENCE_API.md
 */
export async function POST(request: Request) {
  return handleLicenceApiRequest(request);
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
