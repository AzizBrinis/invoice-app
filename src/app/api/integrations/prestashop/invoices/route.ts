import { revalidateTag } from "next/cache";
import { handlePrestashopInvoiceRequest } from "@/server/integrations/prestashop/service";
import { invoiceDetailTag, invoiceListTag, invoiceStatsTag } from "@/server/invoices";
import { revalidateClientList } from "@/server/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Server-to-server endpoint used by the PrestaShop "Generate Invoice" button.
 * Contract: docs/PRESTASHOP_INVOICE_API.md
 */
export async function POST(request: Request) {
  return handlePrestashopInvoiceRequest(request, {
    onInvoiceChanged: (tenantUserId, invoiceId) => {
      // Expire immediately (not stale-while-revalidate): the invoice must be
      // listed in Factures on the very next page load.
      const now = { expire: 0 };
      revalidateTag(invoiceListTag(tenantUserId), now);
      revalidateTag(invoiceStatsTag(tenantUserId), now);
      revalidateTag(invoiceDetailTag(tenantUserId, invoiceId), now);
      revalidateClientList(tenantUserId);
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
