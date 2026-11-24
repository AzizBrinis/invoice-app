import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FULFILMENT_ID = /^dlful-[0-9a-f-]{36}$/;

/**
 * Landing URL of "Traiter la commande" (PrestaShop redirects the employee here):
 * goes to the review page, through the login page when there is no session.
 * Only relative redirects to this app; no data is read or changed.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const target = FULFILMENT_ID.test(id) ? `/produits-digitaux/commandes/${id}` : "/produits-digitaux";
  const user = await getCurrentUser();
  const location = user ? target : `/connexion?${new URLSearchParams({ redirect: target }).toString()}`;
  return NextResponse.redirect(new URL(location, request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
