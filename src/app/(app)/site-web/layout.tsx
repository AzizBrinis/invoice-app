import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function WebsiteSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("website", {
    redirectOnFailure: true,
  });

  return children;
}
