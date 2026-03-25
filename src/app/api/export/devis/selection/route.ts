import { NextResponse } from "next/server";
import { exportSelectedQuotesCsv } from "@/server/csv";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentification requise" },
        { status: 401 },
      );
    }

    ensureCanAccessAppSection(user, "quotes");

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

    const csvStream = await exportSelectedQuotesCsv(ids);
    return new NextResponse(csvStream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=devis-selection.csv",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        message:
          (error as Error).message ?? "Impossible d'exporter ces devis.",
      },
      { status: 500 },
    );
  }
}
