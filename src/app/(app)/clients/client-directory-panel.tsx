"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ExportButton } from "@/components/export-button";
import { formatDate } from "@/lib/formatters";
import {
  deleteClientInlineAction,
  importClientsInlineAction,
  type ClientImportActionState,
} from "@/app/(app)/clients/actions";
import { useClientsDirectory } from "@/hooks/use-clients-directory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMediaQuery } from "@/hooks/use-media-query";
import { clearClientCache } from "@/lib/client-directory-cache";
import { canApplyPathScopedNavigationUpdate } from "@/lib/path-scoped-navigation";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { useToast } from "@/components/ui/toast-provider";
import type { ClientDirectoryQuery, ClientDirectoryResponse } from "@/lib/client-directory-cache";

type ClientDirectoryPanelProps = {
  canManageClients: boolean;
  isFocusedAccount: boolean;
  initialDirectoryPage?: {
    query: ClientDirectoryQuery;
    data: ClientDirectoryResponse;
  } | null;
  initialSearch: string;
  initialStatus: "all" | "actifs" | "inactifs";
  initialPage: number;
  refreshKey?: string | null;
};

const ROW_HEIGHT = 76;
const VIRTUALIZATION_THRESHOLD = 25;
const OVERSCAN = 8;
const INITIAL_CLIENT_IMPORT_ACTION_STATE: ClientImportActionState = {};

function getStatusBadgeClasses(isActive: boolean) {
  return clsx(
    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
    isActive
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  );
}

function buildClientDirectoryTarget(options: {
  pathname: string;
  search?: string;
  status?: "all" | "actifs" | "inactifs";
  page?: number | null;
}) {
  const params = new URLSearchParams();
  if (options.search?.trim()) {
    params.set("recherche", options.search.trim());
  }
  if (options.status && options.status !== "all") {
    params.set("statut", options.status);
  }
  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }
  const query = params.toString();
  return (query ? `${options.pathname}?${query}` : options.pathname) as Route;
}

function ClientTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`client-skeleton-${index}`}
          className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/60"
        />
      ))}
    </div>
  );
}

export function ClientDirectoryPanel({
  canManageClients,
  isFocusedAccount,
  initialDirectoryPage = null,
  initialSearch,
  initialStatus,
  initialPage,
  refreshKey = null,
}: ClientDirectoryPanelProps) {
  const { addToast } = useToast();
  const pathname = usePathname() || "/clients";
  const pagePathnameRef = useRef(pathname);
  const pagePathname = pagePathnameRef.current;
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [status, setStatus] = useState<"all" | "actifs" | "inactifs">(
    initialStatus,
  );
  const normalizedInitialPage = Math.max(initialPage, 1);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const isDesktopViewport = useMediaQuery("(min-width: 768px)");
  const {
    items,
    total,
    pageCount,
    lastLoadedPage,
    isInitialLoading,
    isFetchingMore,
    isValidating,
    error,
    hasMore,
    loadMore,
    refresh,
    prefetchPage,
  } = useClientsDirectory({
    search: debouncedSearch,
    status,
    initialPageData: initialDirectoryPage,
    refreshKey,
  });
  const loadMoreRef = useRef(loadMore);
  const scrollMetricsRef = useRef({ top: 0, height: 480 });
  const [virtualWindow, setVirtualWindow] = useState({
    top: 0,
    height: 480,
  });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hydrationDoneRef = useRef(false);
  const importFormRef = useRef<HTMLFormElement | null>(null);
  const lastHandledImportSubmissionIdRef = useRef<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<
    Record<string, true>
  >({});
  const [clientImportState, importClientFormAction] = useActionState<
    ClientImportActionState,
    FormData
  >(
    importClientsInlineAction,
    INITIAL_CLIENT_IMPORT_ACTION_STATE,
  );
  const [, startDeleteTransition] = useTransition();
  const baseDirectoryState = useMemo(
    () => ({
      items,
      total,
    }),
    [items, total],
  );
  const [clientDirectoryState, setClientDirectoryState] = useState(
    baseDirectoryState,
  );
  const [optimisticDirectory, applyOptimisticUpdate] = useOptimistic(
    clientDirectoryState,
    (
      currentState,
      action: {
        type: "delete";
        clientId: string;
      },
    ) => ({
      items: currentState.items.filter((client) => client.id !== action.clientId),
      total: Math.max(currentState.total - 1, 0),
    }),
  );

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    hydrationDoneRef.current = false;
  }, [initialSearch, initialStatus, normalizedInitialPage, refreshKey]);

  useEffect(() => {
    setSearchInput(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setClientDirectoryState(baseDirectoryState);
  }, [baseDirectoryState]);

  useEffect(() => {
    if (!clientImportState.submissionId) {
      return;
    }
    if (
      lastHandledImportSubmissionIdRef.current ===
      clientImportState.submissionId
    ) {
      return;
    }

    lastHandledImportSubmissionIdRef.current = clientImportState.submissionId;

    if (clientImportState.message) {
      addToast({
        variant: clientImportState.variant ?? "success",
        title: clientImportState.message,
      });
    }

    if (clientImportState.status === "success") {
      importFormRef.current?.reset();
      clearClientCache({ refetchOnNextLoad: true });
      void refresh(1);
    }
  }, [
    addToast,
    clientImportState.message,
    clientImportState.status,
    clientImportState.submissionId,
    clientImportState.variant,
    refresh,
  ]);

  useEffect(() => {
    if (hydrationDoneRef.current || isInitialLoading) {
      return;
    }
    if (
      normalizedInitialPage <= 1 ||
      lastLoadedPage >= normalizedInitialPage ||
      !hasMore
    ) {
      hydrationDoneRef.current = true;
      return;
    }
    void loadMoreRef.current();
  }, [hasMore, isInitialLoading, lastLoadedPage, normalizedInitialPage]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const root = isDesktopViewport ? scrollContainerRef.current : null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!hasMore || isFetchingMore) {
          return;
        }
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreRef.current();
        }
      },
      {
        root,
        rootMargin: isDesktopViewport ? "240px" : "120px",
      },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isFetchingMore, isDesktopViewport]);

  const updateVirtualWindow = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const next = {
      top: container.scrollTop,
      height: container.clientHeight,
    };
    scrollMetricsRef.current = next;
    setVirtualWindow(next);
  }, []);

  useEffect(() => {
    if (!isDesktopViewport) {
      const fallbackHeight = scrollContainerRef.current?.clientHeight ?? 480;
      const fallbackWindow = { top: 0, height: fallbackHeight };
      scrollMetricsRef.current = fallbackWindow;
      setVirtualWindow(fallbackWindow);
      return;
    }
    updateVirtualWindow();
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(() => {
      updateVirtualWindow();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [updateVirtualWindow, isDesktopViewport]);

  const displayedItems = optimisticDirectory.items;
  const totalRecords = optimisticDirectory.total;
  const virtualizationEnabled =
    isDesktopViewport && displayedItems.length > VIRTUALIZATION_THRESHOLD;
  const startIndex = virtualizationEnabled
    ? Math.max(
        Math.floor(virtualWindow.top / ROW_HEIGHT) - OVERSCAN,
        0,
      )
    : 0;
  const viewportCount = virtualizationEnabled
    ? Math.ceil(virtualWindow.height / ROW_HEIGHT) + OVERSCAN * 2
    : displayedItems.length;
  const endIndex = virtualizationEnabled
    ? Math.min(startIndex + viewportCount, displayedItems.length)
    : displayedItems.length;
  const virtualizedItems = virtualizationEnabled
    ? displayedItems.slice(startIndex, endIndex)
    : displayedItems;
  const offsetTop = virtualizationEnabled ? startIndex * ROW_HEIGHT : 0;
  const offsetBottom = virtualizationEnabled
    ? (displayedItems.length - endIndex) * ROW_HEIGHT
    : 0;

  const shareableTarget = useMemo(
    () =>
      buildClientDirectoryTarget({
        pathname: pagePathname,
        search: debouncedSearch,
        status,
      }),
    [debouncedSearch, pagePathname, status],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (
      !canApplyPathScopedNavigationUpdate({
        currentHref: window.location.href,
        ownedPathname: pagePathname,
        nextHref: shareableTarget,
      })
    ) {
      return;
    }
    const currentUrl = new URL(window.location.href);
    const nextUrl = new URL(shareableTarget, window.location.origin);
    const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    const nextPath = `${nextUrl.pathname}${nextUrl.search}${currentUrl.hash}`;
    if (currentPath === nextPath) {
      return;
    }
    window.history.replaceState(window.history.state, "", nextPath);
  }, [pagePathname, shareableTarget]);

  const totalDisplayed = displayedItems.length;
  const currentPageDisplay = Math.max(
    lastLoadedPage || (totalDisplayed > 0 ? 1 : 0),
    1,
  );
  const totalPagesDisplay = Math.max(pageCount, 1);
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Tous les clients" },
      { value: "actifs", label: "Actifs" },
      { value: "inactifs", label: "Inactifs" },
    ],
    [],
  );

  const handleDeleteClient = useCallback(
    (clientId: string) => {
      if (pendingDeleteIds[clientId]) {
        return;
      }

      clearClientCache({ refetchOnNextLoad: true });
      setPendingDeleteIds((current) => ({
        ...current,
        [clientId]: true,
      }));

      startDeleteTransition(async () => {
        applyOptimisticUpdate({
          type: "delete",
          clientId,
        });
        try {
          const result = await deleteClientInlineAction(clientId);
          if (result.status !== "success") {
            setClientDirectoryState((current) => ({ ...current }));
            addToast({
              variant: "error",
              title: result.message,
            });
            return;
          }

          setClientDirectoryState((current) => ({
            items: current.items.filter((client) => client.id !== clientId),
            total: Math.max(current.total - 1, 0),
          }));
          addToast({
            variant: "success",
            title: result.message,
          });
          await refresh(lastLoadedPage || 1);
        } catch (error) {
          setClientDirectoryState((current) => ({ ...current }));
          addToast({
            variant: "error",
            title:
              error instanceof Error
                ? error.message
                : "Impossible de supprimer ce client.",
          });
        } finally {
          setPendingDeleteIds((current) => {
            const next = { ...current };
            delete next[clientId];
            return next;
          });
        }
      });
    },
    [
      addToast,
      applyOptimisticUpdate,
      lastLoadedPage,
      pendingDeleteIds,
      refresh,
      startDeleteTransition,
    ],
  );
  const importSummary = clientImportState.summary;
  const importIssueCount =
    (importSummary?.issues.length ?? 0) + (importSummary?.remainingIssueCount ?? 0);
  const importSummaryDescription = importSummary
    ? [
        `${importSummary.totalRows} ligne(s) lue(s)`,
        `${importSummary.createdCount} cree(s)`,
        `${importSummary.updatedCount} mise(s) a jour`,
        `${importSummary.skippedCount} ignoree(s)`,
      ].join(" - ")
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Clients
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {isFocusedAccount
              ? "Accédez au dossier client, aux services liés et à l'historique des paiements."
              : "Recherche incrémentale, pagination fluide et actions rapides."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <ExportButton
            variant="ghost"
            className="w-full text-sm text-blue-600 dark:text-blue-400 sm:w-auto"
            href="/api/export/clients"
            loadingText="Export…"
          >
            Export CSV
          </ExportButton>
          {canManageClients ? (
            <Button
              asChild
              className="w-full sm:w-auto"
            >
              <PrefetchLink href="/clients/nouveau">Nouveau client</PrefetchLink>
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="error" title={error}>
          <div className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void refresh(lastLoadedPage || 1)}
            >
              Réessayer
            </Button>
          </div>
        </Alert>
      ) : null}

      {canManageClients ? (
        <form
          ref={importFormRef}
          action={importClientFormAction}
          className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="clients-import-file" className="label">
              Import CSV (colonnes : nom, societe, e-mail, telephone, TVA, etc.)
            </label>
            <input
              id="clients-import-file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="input border-2 border-dashed"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Les lignes invalides ou ambiguës sont ignorees, et les doublons
              detectes sont resumes apres l&apos;import.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ExportButton
              href="/api/export/clients/sample"
              variant="ghost"
              className="w-full text-sm sm:w-auto"
            >
              Modele CSV
            </ExportButton>
            <FormSubmitButton
              variant="secondary"
              className="w-full sm:w-auto"
              pendingLabel="Import en cours..."
            >
              Importer les clients
            </FormSubmitButton>
          </div>

          {clientImportState.message ? (
            <Alert
              variant={clientImportState.status === "error" ? "error" : "success"}
              title={clientImportState.message}
              description={importSummaryDescription ?? undefined}
            >
              {importSummary ? (
                <div className="text-xs opacity-80">
                  {importSummary.duplicateCount} doublon(s) detecte(s),{" "}
                  {importSummary.validationErrorCount} ligne(s) invalide(s).
                </div>
              ) : null}
            </Alert>
          ) : null}

          {importSummary && importIssueCount > 0 ? (
            <Alert
              variant={clientImportState.status === "error" ? "error" : "warning"}
              title={`${importIssueCount} point(s) a verifier`}
            >
              <ul className="space-y-1 pt-1 text-xs">
                {importSummary.issues.map((issue) => (
                  <li key={`${issue.rowNumber}-${issue.message}`}>
                    Ligne {issue.rowNumber}: {issue.message}
                  </li>
                ))}
              </ul>
              {importSummary.remainingIssueCount > 0 ? (
                <p className="pt-2 text-xs">
                  +{importSummary.remainingIssueCount} autre(s) ligne(s)
                  masquee(s) dans le resume.
                </p>
              ) : null}
            </Alert>
          ) : null}
        </form>
      ) : null}

      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="clients-search">
            Recherche
          </label>
          <Input
            id="clients-search"
            type="search"
            autoComplete="off"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Nom, e-mail, TVA…"
          />
        </div>
        <div>
          <label className="label" htmlFor="clients-status">
            Statut
          </label>
          <select
            id="clients-status"
            className="input"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | "actifs" | "inactifs")
            }
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-0">
        <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {totalDisplayed > 0 ? (
              <span>
                {totalDisplayed} / {totalRecords} clients visibles
              </span>
            ) : (
              <span>0 client trouvé</span>
            )}
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Page {currentPageDisplay} / {totalPagesDisplay}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            {isValidating ? (
              <span className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-300">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Mise à jour…
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              loading={isValidating && !isInitialLoading}
              onClick={() => {
                hydrationDoneRef.current = true;
                void refresh(lastLoadedPage || 1);
              }}
            >
              Actualiser
            </Button>
          </div>
        </div>
        {isInitialLoading ? (
          <ClientTableSkeleton />
        ) : (
          <div
            ref={scrollContainerRef}
            className={clsx(
              "md:max-h-[70vh] md:overflow-y-auto",
              isDesktopViewport
                ? "max-h-[70vh] overflow-y-auto"
                : "max-h-none overflow-visible",
            )}
            onScroll={isDesktopViewport ? updateVirtualWindow : undefined}
            aria-busy={isValidating}
          >
            {isDesktopViewport ? (
              <>
                <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Nom / Raison sociale</th>
                      <th className="px-4 py-3 text-left">Contact</th>
                      <th className="px-4 py-3 text-left">TVA</th>
                      <th className="px-4 py-3 text-left">Statut</th>
                      <th className="px-4 py-3 text-left">Modifié</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {offsetTop > 0 ? (
                      <tr aria-hidden="true">
                        <td colSpan={6} style={{ height: offsetTop }} />
                      </tr>
                    ) : null}
                    {virtualizedItems.map((client) => (
                      <tr
                        key={client.id}
                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      >
                        <td className="min-w-0 px-4 py-3 align-top">
                          <div
                            className="truncate font-medium text-zinc-900 dark:text-zinc-100"
                            title={client.displayName ?? undefined}
                          >
                            {client.displayName}
                          </div>
                          {client.companyName ? (
                            <div
                              className="truncate text-xs text-zinc-500 dark:text-zinc-400"
                              title={client.companyName}
                            >
                              {client.companyName}
                            </div>
                          ) : null}
                        </td>
                        <td className="min-w-0 px-4 py-3 align-top text-zinc-600 dark:text-zinc-300">
                          <div className="truncate" title={client.email ?? undefined}>
                            {client.email ?? "—"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {client.phone ?? ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-zinc-600 dark:text-zinc-300">
                          {client.vatNumber ?? "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={getStatusBadgeClasses(client.isActive)}>
                            {client.isActive ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-zinc-600 dark:text-zinc-300">
                          {formatDate(client.updatedAt)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-2">
                            <Button asChild variant="secondary" className="px-2 py-1 text-xs">
                              <PrefetchLink href={`/clients/${client.id}`}>
                                Ouvrir
                              </PrefetchLink>
                            </Button>
                            {canManageClients ? (
                              <Button asChild variant="ghost" className="px-2 py-1 text-xs">
                                <PrefetchLink
                                  href={`/clients/${client.id}/modifier`}
                                >
                                  Modifier
                                </PrefetchLink>
                              </Button>
                            ) : null}
                            {canManageClients ? (
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  handleDeleteClient(client.id);
                                }}
                              >
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  loading={Boolean(pendingDeleteIds[client.id])}
                                  className="px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Supprimer
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {offsetBottom > 0 ? (
                      <tr aria-hidden="true">
                        <td colSpan={6} style={{ height: offsetBottom }} />
                      </tr>
                    ) : null}
                    {!isInitialLoading && displayedItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                        >
                          Aucun client ne correspond à ces critères.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <div ref={sentinelRef} className="h-4 w-full" />
              </>
            ) : (
              <>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {displayedItems.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Aucun client ne correspond à ces critères.
                    </div>
                  ) : (
                    displayedItems.map((client) => (
                      <article
                        key={client.id}
                        className="space-y-4 px-4 py-4"
                      >
                        <div className="space-y-1">
                          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            {client.displayName}
                          </h2>
                          {client.companyName ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              {client.companyName}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                              Contact
                            </p>
                            <div className="mt-1 break-words text-zinc-900 dark:text-zinc-100">
                              {client.email ?? "—"}
                            </div>
                            {client.phone ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {client.phone}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-6">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                TVA
                              </p>
                              <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                                {client.vatNumber ?? "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Modifié
                              </p>
                              <p className="mt-1 text-zinc-900 dark:text-zinc-100">
                                {formatDate(client.updatedAt)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Statut
                              </p>
                              <div className="mt-1">
                                <span className={getStatusBadgeClasses(client.isActive)}>
                                  {client.isActive ? "Actif" : "Inactif"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            asChild
                            variant="secondary"
                            className="w-full justify-center"
                          >
                            <PrefetchLink href={`/clients/${client.id}`}>
                              Ouvrir le dossier
                            </PrefetchLink>
                          </Button>
                          {canManageClients ? (
                            <Button
                              asChild
                              variant="ghost"
                              className="w-full justify-center"
                            >
                              <PrefetchLink
                                href={`/clients/${client.id}/modifier`}
                              >
                                Modifier
                              </PrefetchLink>
                            </Button>
                          ) : null}
                          {canManageClients ? (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                handleDeleteClient(client.id);
                              }}
                            >
                              <Button
                                type="submit"
                                variant="danger"
                                loading={Boolean(pendingDeleteIds[client.id])}
                                className="w-full justify-center"
                              >
                                Supprimer
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
                <div ref={sentinelRef} className="h-4 w-full" />
              </>
            )}
          </div>
        )}
      </div>

      {hasMore ? (
        <div className="flex items-center justify-center">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            loading={isFetchingMore}
            onClick={() => {
              prefetchPage(lastLoadedPage + 1);
              void loadMore();
            }}
            onMouseEnter={() => prefetchPage(lastLoadedPage + 1)}
          >
            Charger plus
          </Button>
        </div>
      ) : null}
    </div>
  );
}
