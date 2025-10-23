import { NextResponse } from "next/server";
import { generateInvoicePdf } from "@/server/pdf";

type PageParams = { id: string };

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: PageParams | Promise<PageParams> },
) {
  const resolvedParams = isPromise<PageParams>(params) ? await params : params;
  try {
    const buffer = await generateInvoicePdf(resolvedParams.id);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-${resolvedParams.id}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message ?? "Erreur de génération du PDF" },
      { status: 500 },
    );
  }
}
