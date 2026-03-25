import { NextResponse } from "next/server";
import { exportProductsCsv } from "@/server/csv";
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

    ensureCanAccessAppSection(user, "products");

    const csvStream = await exportProductsCsv();
    return new NextResponse(csvStream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=produits.csv",
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
      { message: "Impossible de générer l'export." },
      { status: 500 },
    );
  }
}
