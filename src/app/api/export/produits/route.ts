import { NextResponse } from "next/server";
import { exportProductsCsv } from "@/server/csv";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Authentification requise" },
      { status: 401 },
    );
  }

  const csvStream = await exportProductsCsv();
  return new NextResponse(csvStream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=produits.csv",
    },
  });
}
