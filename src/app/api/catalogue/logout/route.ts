import { NextResponse } from "next/server";
import { signOutClient } from "@/lib/client-auth";

export async function POST() {
  await signOutClient();
  return NextResponse.json({ ok: true });
}
