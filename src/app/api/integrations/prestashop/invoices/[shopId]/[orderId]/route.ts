import { handlePrestashopInvoiceDownload } from "@/server/integrations/prestashop/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

/**
 * Signed, read-only download of the invoice generated for a PrestaShop order.
 * The PDF is re-rendered with the current company settings on every call.
 * Contract: docs/PRESTASHOP_INVOICE_API.md
 */
export async function GET(request: Request, { params }: RouteContext) {
  return handlePrestashopInvoiceDownload(request, await params);
}
