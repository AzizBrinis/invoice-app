import { NextResponse } from "next/server";
import { generateQuotePdf } from "@/server/pdf";
import { getCurrentUser } from "@/lib/auth";

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Authentification requise" },
      { status: 401 },
    );
  }

  const resolvedParams = isPromise<PageParams>(params) ? await params : params;
  try {
    const buffer = await generateQuotePdf(resolvedParams.id);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="devis-${resolvedParams.id}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message ?? "Erreur de génération du PDF" },
      { status: 500 },
    );
  }
}
