import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";

export default async function SettingsSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAppSectionAccess("settings", {
    redirectOnFailure: true,
  });

  return children;
}
