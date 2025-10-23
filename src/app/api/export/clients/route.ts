import { NextResponse } from "next/server";
import { exportClientsCsv } from "@/server/csv";

export async function GET() {
  const csv = await exportClientsCsv();
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=clients.csv",
    },
  });
}
