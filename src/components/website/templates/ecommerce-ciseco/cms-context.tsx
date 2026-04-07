"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

export type CisecoCmsPageLink = {
  id: string;
  title: string;
  path: string;
  showInFooter: boolean;
};

const CmsPagesContext = createContext<CisecoCmsPageLink[]>([]);

type CisecoCmsPagesProviderProps = {
  links: CisecoCmsPageLink[];
  children: ReactNode;
};

export function CisecoCmsPagesProvider({
  links,
  children,
}: CisecoCmsPagesProviderProps) {
  return (
    <CmsPagesContext.Provider value={links}>
      {children}
    </CmsPagesContext.Provider>
  );
}

export function useCisecoCmsPages() {
  return useContext(CmsPagesContext);
}
