import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function CollaboratorsSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("collaborators", {
    redirectOnFailure: true,
  });

  return children;
}
