import { timingSafeEqual } from "node:crypto";
import { executeStatement } from "@/lib/db/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Authenticated, read-only deployment/migration probe. Never returns tenant data.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET_TOKEN;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (!secret || suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return new Response(null, { status: 404 });
  }
  const [probe] = await executeStatement<{ amount: number }>(
    "SELECT 1234.500::numeric(14,3) AS amount",
  );
  const columns = await executeStatement<{ table_name: string; column_name: string; type: string }>(`
    SELECT c.relname AS table_name, a.attname AS column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS type
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped AND (
      (c.relname IN ('InvoiceLine', 'QuoteLine') AND a.attname IN ('unitPriceHTCents', 'discountAmountCents')) OR
      (c.relname IN ('Invoice', 'Quote') AND a.attname = 'globalDiscountAmountCents'))
    ORDER BY c.relname, a.attname
  `);
  const compatible = typeof probe.amount === "number" && probe.amount === 1234.5;
  return Response.json({
    adapterVersion: 2,
    releasePhase: "three-decimal",
    compatible,
    poolerQueriesSerialized: true,
    numericProbe: probe.amount,
    columns,
    deployment: process.env.VERCEL_URL ?? "local",
    region: process.env.VERCEL_REGION ?? "local",
  }, {
    status: compatible ? 200 : 503,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
