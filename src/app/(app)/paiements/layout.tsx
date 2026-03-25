import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function PaymentsSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("payments", {
    redirectOnFailure: true,
  });

  return children;
}
