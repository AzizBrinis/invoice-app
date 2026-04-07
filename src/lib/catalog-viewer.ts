export type CatalogClientProfile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  companyName: string;
  vatNumber: string;
  notes: string;
  avatarUrl: string | null;
};

export type CatalogViewerState = {
  authStatus: "authenticated" | "unauthenticated";
  profile: CatalogClientProfile | null;
};

export const EMPTY_CATALOG_CLIENT_PROFILE: CatalogClientProfile = {
  name: "",
  email: "",
  phone: "",
  address: "",
  companyName: "",
  vatNumber: "",
  notes: "",
  avatarUrl: null,
};

export function toCatalogClientProfile(client: {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  vatNumber: string | null;
  notes: string | null;
}): CatalogClientProfile {
  return {
    name: client.displayName?.trim() ?? "",
    email: client.email?.trim() ?? "",
    phone: client.phone?.trim() ?? "",
    address: client.address?.trim() ?? "",
    companyName: client.companyName?.trim() ?? "",
    vatNumber: client.vatNumber?.trim() ?? "",
    notes: client.notes?.trim() ?? "",
    avatarUrl: null,
  };
}
