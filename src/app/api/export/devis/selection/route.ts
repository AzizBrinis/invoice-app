import { NextResponse } from "next/server";
import { exportSelectedQuotesCsv } from "@/server/csv";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawIds = searchParams.get("ids");
  if (!rawIds) {
    return NextResponse.json(
      { message: "Aucun devis sélectionné." },
      { status: 400 },
    );
  }
  const ids = rawIds
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (ids.length === 0) {
    return NextResponse.json(
      { message: "Aucun devis sélectionné." },
      { status: 400 },
    );
  }

  try {
    const csvStream = await exportSelectedQuotesCsv(ids);
    return new NextResponse(csvStream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=devis-selection.csv",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          (error as Error).message ?? "Impossible d'exporter ces devis.",
      },
      { status: 500 },
    );
  }
}
