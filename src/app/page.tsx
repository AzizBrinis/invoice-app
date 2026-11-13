import { redirect } from "next/navigation";
import { getSessionTokenFromCookie } from "@/lib/auth";

export default async function HomePage() {
  // This page only chooses a destination. The protected app layout validates
  // the session against the database before rendering any account data.
  const token = await getSessionTokenFromCookie();

  if (token) {
    redirect("/tableau-de-bord");
  }

  redirect("/connexion");
}
