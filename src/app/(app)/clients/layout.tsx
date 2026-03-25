import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function ClientsSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("clients", {
    redirectOnFailure: true,
  });

  return children;
}
