import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function AssistantSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("assistant", {
    redirectOnFailure: true,
  });

  return children;
}
