import { revalidateTag } from "next/cache";
import { handleDigitalOrderRequest } from "@/server/digital-products/fulfilment";
import { defaultPrestashopInvoiceDeps } from "@/server/integrations/prestashop/service";
import { invoiceDetailTag, invoiceListTag, invoiceStatsTag } from "@/server/invoices";
import { revalidateClientList } from "@/server/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * PrestaShop instant delivery: licences + invoice + customer e-mail in one
 * signed request. Contract: docs/DIGITAL_LICENCE_API.md (« Commandes numériques »).
 */
export async function POST(request: Request) {
  return handleDigitalOrderRequest(request, {
    invoice: {
      ...defaultPrestashopInvoiceDeps,
      onInvoiceChanged: (tenantUserId, invoiceId) => {
        const now = { expire: 0 };
        revalidateTag(invoiceListTag(tenantUserId), now);
        revalidateTag(invoiceStatsTag(tenantUserId), now);
        revalidateTag(invoiceDetailTag(tenantUserId, invoiceId), now);
        revalidateClientList(tenantUserId);
      },
    },
  });
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
