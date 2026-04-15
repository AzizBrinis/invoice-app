"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WebsiteBuilderFooter } from "@/lib/website/builder";

const FooterContext = createContext<WebsiteBuilderFooter | null>(null);

type CisecoFooterProviderProps = {
  config: WebsiteBuilderFooter | null | undefined;
  children: ReactNode;
};

export function CisecoFooterProvider({
  config,
  children,
}: CisecoFooterProviderProps) {
  return (
    <FooterContext.Provider value={config ?? null}>
      {children}
    </FooterContext.Provider>
  );
}

export function useCisecoFooter() {
  return useContext(FooterContext);
}
