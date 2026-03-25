import { AccountPermission } from "@prisma/client";
import {
  hasAccountPermission,
  isClientPaymentsAccount,
  requireAppSectionAccess,
} from "@/lib/authorization";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { listClients, type ClientFilters } from "@/server/clients";
import { ClientDirectoryPanel } from "./client-directory-panel";

export const dynamic = "force-dynamic";
const CLIENT_DIRECTORY_PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;
type ClientsPageProps = { searchParams?: Promise<SearchParams> };

export default async function ClientsPage({
  searchParams,
}: ClientsPageProps) {
  const user = await requireAppSectionAccess("clients", {
    redirectOnFailure: true,
  });
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const search = Array.isArray(resolvedSearchParams?.recherche)
    ? resolvedSearchParams.recherche[0]
    : resolvedSearchParams?.recherche ?? "";
  const statutParam = Array.isArray(resolvedSearchParams?.statut)
    ? resolvedSearchParams.statut[0]
    : (resolvedSearchParams?.statut as string | undefined);
  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams?.page;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error ?? null;
  const refreshKey = Array.isArray(resolvedSearchParams?._clientsRefresh)
    ? resolvedSearchParams._clientsRefresh[0]
    : resolvedSearchParams?._clientsRefresh ?? null;

  const parsedPage = Number(pageParam ?? "1");
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.trunc(parsedPage) : 1;
  const status =
    statutParam === "actifs" || statutParam === "inactifs"
      ? (statutParam as "actifs" | "inactifs")
      : "all";
  const initialDirectoryFilters: ClientFilters = {
    search: search || undefined,
    page: 1,
    pageSize: CLIENT_DIRECTORY_PAGE_SIZE,
    isActive:
      status === "actifs" ? true : status === "inactifs" ? false : "all",
  };
  const initialDirectoryPage = await listClients(
    initialDirectoryFilters,
    user.activeTenantId ?? user.tenantId ?? user.id,
  );

  const successMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams?.message ?? null;
  const warningMessage = Array.isArray(resolvedSearchParams?.warning)
    ? resolvedSearchParams.warning[0]
    : resolvedSearchParams?.warning ?? null;

  const flashMessages: FlashMessage[] = [];
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (warningMessage) {
    flashMessages.push({ variant: "warning", title: warningMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      <ClientDirectoryPanel
        canManageClients={hasAccountPermission(
          user,
          AccountPermission.CLIENTS_MANAGE,
        )}
        isFocusedAccount={isClientPaymentsAccount(user)}
        initialDirectoryPage={{
          query: {
            search: search || undefined,
            status,
            page: 1,
            pageSize: CLIENT_DIRECTORY_PAGE_SIZE,
          },
          data: {
            ...initialDirectoryPage,
            items: initialDirectoryPage.items.map((client) => ({
              ...client,
              updatedAt:
                client.updatedAt instanceof Date
                  ? client.updatedAt.toISOString()
                  : client.updatedAt,
            })),
          },
        }}
        initialSearch={search}
        initialStatus={status}
        initialPage={page}
        refreshKey={refreshKey}
      />
    </div>
  );
}
