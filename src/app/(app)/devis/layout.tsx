import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function QuotesSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("quotes", {
    redirectOnFailure: true,
  });

  return children;
}
