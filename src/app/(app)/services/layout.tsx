import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function ServicesSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("services", {
    redirectOnFailure: true,
  });

  return children;
}
