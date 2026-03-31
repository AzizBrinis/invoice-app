import { NextResponse } from "next/server";
import { exportClientImportSampleCsv } from "@/server/csv";
import { getCurrentUser } from "@/lib/auth";
import { ensureCanAccessAppSection } from "@/lib/authorization";
import { AuthorizationError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { message: "Authentification requise" },
        { status: 401 },
      );
    }

    ensureCanAccessAppSection(user, "clients");

    return new NextResponse(exportClientImportSampleCsv(), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          "attachment; filename=modele-import-clients.csv",
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
      { message: "Impossible de generer le modele CSV." },
      { status: 500 },
    );
  }
}
