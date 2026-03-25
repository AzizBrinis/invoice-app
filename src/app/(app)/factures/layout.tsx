import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function InvoicesSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("invoices", {
    redirectOnFailure: true,
  });

  return children;
}
