import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function ProductsSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("products", {
    redirectOnFailure: true,
  });

  return children;
}
