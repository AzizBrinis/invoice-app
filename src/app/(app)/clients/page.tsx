import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { ClientsPageSkeleton } from "@/components/skeletons";
import { ClientDirectoryPanel } from "./client-directory-panel";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = isPromise<SearchParams>(searchParams)
    ? await searchParams
    : searchParams;

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

  const page = Number(pageParam ?? "1") || 1;

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

  const searchQuery = new URLSearchParams();
  if (search) searchQuery.set("recherche", search);
  if (statutParam) searchQuery.set("statut", statutParam);
  if (page > 1) searchQuery.set("page", String(page));
  const redirectBase = searchQuery.toString()
    ? `/clients?${searchQuery.toString()}`
    : "/clients";

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      {errorMessage ? <Alert variant="error" title={errorMessage} /> : null}
      {successMessage ? <Alert variant="success" title={successMessage} /> : null}
      {warningMessage ? <Alert variant="warning" title={warningMessage} /> : null}
      <Suspense fallback={<ClientsPageSkeleton />}>
        <ClientDirectoryPanel
          redirectBase={redirectBase}
          initialSearch={search}
          initialStatus={
            statutParam === "actifs" || statutParam === "inactifs"
              ? (statutParam as "actifs" | "inactifs")
              : "all"
          }
          initialPage={page}
        />
      </Suspense>
    </div>
  );
}
