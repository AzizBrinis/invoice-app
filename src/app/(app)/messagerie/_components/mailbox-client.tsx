"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import {
  Mail,
  Paperclip,
  RefreshCw,
  X,
  Reply,
  ReplyAll,
  Forward,
  Search,
  Filter,
} from "lucide-react";
import type {
  Mailbox,
  MailboxListItem,
  MailboxPageResult,
  MessageDetail,
} from "@/server/messaging";
import {
  fetchMailboxPageAction,
  fetchMessageDetailAction,
  type ActionResult,
} from "@/app/(app)/messagerie/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { MailboxSkeleton } from "@/app/(app)/messagerie/_components/mailbox-skeleton";

type MailboxClientProps = {
  mailbox: Mailbox;
  title: string;
  description: string;
  isConfigured: boolean;
  initialPage: MailboxPageResult | null;
  initialError: string | null;
  emptyStateMessage: string;
  clients: Array<{ id: string; displayName: string; email: string | null }>;
};

const STATUS_BADGES: Record<
  string,
  { label: string; variant: "info" | "success" | "warning" | "danger" | "neutral" }
> = {
  ENREGISTRE: { label: "Enregistré", variant: "neutral" },
  ENVOYE: { label: "Envoyé", variant: "info" },
  LECTURE: { label: "Lu", variant: "success" },
  ECHEC: { label: "Échec", variant: "danger" },
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function uniqByUid(items: MailboxListItem[]): MailboxListItem[] {
  const map = new Map<number, MailboxListItem>();
  items.forEach((item) => {
    map.set(item.uid, item);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function MailboxClient({
  mailbox,
  title,
  description,
  isConfigured,
  initialPage,
  initialError,
  emptyStateMessage,
  clients,
}: MailboxClientProps) {
  const { addToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement | null>(null);
  const filtersInitializedRef = useRef(false);

  const [messages, setMessages] = useState<MailboxListItem[]>(
    initialPage?.messages ?? [],
  );
  const [page, setPage] = useState(initialPage?.page ?? 1);
  const [pageSize] = useState(initialPage?.pageSize ?? 20);
  const [hasMore, setHasMore] = useState(initialPage?.hasMore ?? false);
  const [listError, setListError] = useState(initialError);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasAttachmentsOnly, setHasAttachmentsOnly] = useState(false);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>("");

  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const safeActionCall = useCallback(
    async <T,>(
      action: () => Promise<ActionResult<T>>,
    ): Promise<ActionResult<T> | null> => {
      try {
        return await action();
      } catch (error) {
        console.error(
          "Erreur réseau lors de l'appel à une action:",
          error,
        );
        addToast({
          variant: "error",
          title: "Erreur réseau.",
        });
        return null;
      }
    },
    [addToast],
  );

  const fetchPage = useCallback(
    async (pageNumber: number) =>
      safeActionCall(() =>
        fetchMailboxPageAction({
          mailbox,
          page: pageNumber,
          pageSize,
          search: debouncedSearch.length ? debouncedSearch : undefined,
          filters:
            Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
        }),
      ),
    [activeFilters, debouncedSearch, mailbox, pageSize, safeActionCall],
  );

  useEffect(() => {
    setMessages(initialPage?.messages ?? []);
    setPage(initialPage?.page ?? 1);
    setHasMore(initialPage?.hasMore ?? false);
    setListError(initialError);
  }, [initialError, initialPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!isConfigured) return;
    if (!filtersInitializedRef.current) {
      filtersInitializedRef.current = true;
      return;
    }
    void handleRefresh({ silent: true, scroll: false });
  }, [activeFilters, debouncedSearch, handleRefresh, isConfigured]);

  const selectedUid = useMemo(() => {
    const raw = searchParams.get("message");
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  const activeFilters = useMemo(
    () => ({
      ...(unreadOnly ? { unreadOnly: true } : {}),
      ...(hasAttachmentsOnly ? { hasAttachments: true } : {}),
      ...(selectedClientFilter ? { clientId: selectedClientFilter } : {}),
    }),
    [hasAttachmentsOnly, selectedClientFilter, unreadOnly],
  );

  useEffect(() => {
    if (!selectedUid) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let isCancelled = false;
    const loadDetail = async () => {
      setDetail(null);
      setDetailLoading(true);
      setDetailError(null);
      try {
        const result = await safeActionCall(() =>
          fetchMessageDetailAction({
            mailbox,
            uid: selectedUid,
          }),
        );
        if (!result) return;
        if (result.success) {
          if (isCancelled) return;
          setDetail(result.data);
          setMessages((current) =>
            current.map((item) =>
              item.uid === selectedUid
                ? { ...item, seen: true }
                : item,
            ),
          );
        } else {
          if (isCancelled) return;
          setDetail(null);
          const errorMessage =
            result.message ?? "Échec de chargement du message.";
          setDetailError(errorMessage);
          addToast({
            variant: "error",
            title: "Échec de chargement du message.",
            description:
              errorMessage !== "Échec de chargement du message."
                ? errorMessage
                : undefined,
          });
        }
      } finally {
        if (!isCancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      isCancelled = true;
    };
  }, [addToast, mailbox, safeActionCall, selectedUid]);

  const handleSelectMessage = (uid: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("message", String(uid));
    router.replace(`${pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  const handleClearSelection = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("message");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleOpenComposer = useCallback(
    (mode: "reply" | "reply_all" | "forward") => {
      if (!selectedUid) {
        addToast({
          variant: "warning",
          title: "Sélectionnez un message avant de répondre.",
        });
        return;
      }
      const params = new URLSearchParams({
        mode,
        mailbox,
        uid: String(selectedUid),
      });
      router.push(`/messagerie/nouveau-message?${params.toString()}`);
    },
    [addToast, mailbox, router, selectedUid],
  );

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const result = await fetchPage(page + 1);
    setLoadingMore(false);
    if (!result) return;
    if (!result.success) {
      addToast({
        variant: "error",
        title: result.message,
      });
      return;
    }
    setMessages((current) =>
      uniqByUid([...current, ...result.data.messages]),
    );
    setPage(result.data.page);
    setHasMore(result.data.hasMore);
  };

  const handleRefresh = useCallback(
    async (options?: { silent?: boolean; scroll?: boolean }) => {
      setRefreshing(true);
      const result = await fetchPage(1);
      setRefreshing(false);
      if (!result) return;
      if (!result.success) {
        addToast({
          variant: "error",
          title: result.message,
        });
        return;
      }
      setMessages(result.data.messages);
      setPage(result.data.page);
      setHasMore(result.data.hasMore);
      setListError(null);
      if (!options?.silent) {
        addToast({
          variant: "success",
          title: "Messages actualisés.",
        });
      }
      if (listRef.current) {
        listRef.current.scrollTo({
          top: 0,
          behavior: options?.scroll === false ? "auto" : "smooth",
        });
      }
    },
    [addToast, fetchPage],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher (sujet, contact, client)"
                className="pl-9"
                disabled={!isConfigured}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleRefresh()}
              loading={refreshing}
              disabled={!isConfigured}
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1 uppercase tracking-wide">
              <Filter className="h-3 w-3" />
              Filtres
            </span>
            <Button
              type="button"
              variant={unreadOnly ? "secondary" : "ghost"}
              className={clsx(
                "px-3 py-1 text-xs",
                unreadOnly
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"
                  : "text-zinc-600 dark:text-zinc-300",
              )}
              onClick={() => setUnreadOnly((value) => !value)}
              disabled={!isConfigured}
            >
              Non lus
            </Button>
            <Button
              type="button"
              variant={hasAttachmentsOnly ? "secondary" : "ghost"}
              className={clsx(
                "px-3 py-1 text-xs",
                hasAttachmentsOnly
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"
                  : "text-zinc-600 dark:text-zinc-300",
              )}
              onClick={() => setHasAttachmentsOnly((value) => !value)}
              disabled={!isConfigured}
            >
              Avec pièces jointes
            </Button>
            <select
              value={selectedClientFilter}
              onChange={(event) => setSelectedClientFilter(event.target.value)}
              className="input h-9 w-full text-xs sm:w-60"
              disabled={!isConfigured}
            >
              <option value="">Tous les clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.displayName}
                  {client.email ? ` (${client.email})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!isConfigured ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
          Configurez vos identifiants IMAP pour afficher cette rubrique.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
          <div
            ref={listRef}
            className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-4 lg:max-h-[78vh] lg:overflow-y-auto lg:pr-2"
          >
            {listError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
                {listError}
              </div>
            ) : !hasMessages ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
                <Mail className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
                <p>{emptyStateMessage}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {messages.map((message) => {
                    const active = selectedUid === message.uid;
                    return (
                      <li key={message.uid}>
                        <button
                          type="button"
                          onClick={() => handleSelectMessage(message.uid)}
                          className={clsx(
                            "w-full rounded-lg border px-3 py-2.5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                            active
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/20 dark:text-blue-200"
                              : "border-zinc-200 bg-white text-zinc-800 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-100",
                          )}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p
                                  className={clsx(
                                    "text-sm font-semibold leading-tight",
                                    message.seen
                                      ? "text-current"
                                      : "text-blue-600 dark:text-blue-200",
                                  )}
                                >
                                  {message.subject}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {message.from}
                                </p>
                              </div>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {formatDate(message.date)}
                              </span>
                            </div>
                            {message.to.length ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                À :{" "}
                                {message.to.slice(0, 3).join(", ")}
                                {message.to.length > 3 ? "…" : ""}
                              </p>
                            ) : null}
                            {message.hasAttachments ? (
                              <Badge variant="info" className="w-fit">
                                <span className="inline-flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  Pièces jointes
                                </span>
                              </Badge>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2">
                              {message.client ? (
                                <Badge variant="neutral" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                                  {message.client.displayName}
                                </Badge>
                              ) : null}
                              {message.status ? (
                                <Badge variant={STATUS_BADGES[message.status]?.variant ?? "neutral"}>
                                  {STATUS_BADGES[message.status]?.label ?? message.status}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {loadingMore ? (
                  <MailboxSkeleton rows={3} />
                ) : null}

                {hasMore ? (
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleLoadMore}
                      loading={loadingMore}
                    >
                      Charger plus
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {!selectedUid ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                <Mail className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
                <p>Sélectionnez un message pour afficher les détails.</p>
              </div>
            ) : detailLoading ? (
              <div className="flex h-full items-center justify-center py-12">
                <Spinner label="Chargement du message..." />
              </div>
            ) : detailError ? (
              <div className="flex h-full flex-col gap-3">
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
                  {detailError}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClearSelection}
                >
                  Fermer
                </Button>
              </div>
            ) : detail ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOpenComposer("reply")}
                    className="flex items-center gap-2"
                  >
                    <Reply className="h-4 w-4" />
                    Répondre
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOpenComposer("reply_all")}
                    className="flex items-center gap-2"
                  >
                    <ReplyAll className="h-4 w-4" />
                    Répondre à tous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOpenComposer("forward")}
                    className="flex items-center gap-2"
                  >
                    <Forward className="h-4 w-4" />
                    Transférer
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {detail.subject}
                      </p>
                      {detail.status ? (
                        <Badge variant={STATUS_BADGES[detail.status]?.variant ?? "neutral"}>
                          {STATUS_BADGES[detail.status]?.label ?? detail.status}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(detail.date)}
                    </p>
                    {detail.client ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Client associé : {" "}
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">
                          {detail.client.displayName}
                        </span>
                        {detail.client.email ? ` (${detail.client.email})` : ""}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClearSelection}
                    className="h-8 px-2"
                  >
                    <X className="h-4 w-4" />
                    Fermer
                  </Button>
                </div>
                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {detail.from ? (
                    <p>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        De :
                      </span>{" "}
                      {detail.from}
                    </p>
                  ) : null}
                  {detail.to.length ? (
                    <p>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        À :
                      </span>{" "}
                      {detail.to.join(", ")}
                    </p>
                  ) : null}
                  {detail.cc.length ? (
                    <p>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Cc :
                      </span>{" "}
                      {detail.cc.join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100">
                  {detail.html ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:font-semibold prose-a:text-blue-600"
                      dangerouslySetInnerHTML={{
                        __html: detail.html,
                      }}
                    />
                  ) : detail.text ? (
                    <pre className="whitespace-pre-wrap text-sm">
                      {detail.text}
                    </pre>
                  ) : (
                    <p>Contenu indisponible.</p>
                  )}
                </div>

                {detail.attachments.length ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Pièces jointes
                    </h3>
                    <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {detail.attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-zinc-400" />
                            <div>
                              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                {attachment.filename}
                              </p>
                              <p className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                {attachment.contentType} ·{" "}
                                {formatFileSize(attachment.size)}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 ko";
  }
  const units = ["octets", "ko", "Mo", "Go"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? value : value.toFixed(1);
  return `${formatted} ${units[exponent]}`;
}
