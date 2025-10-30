"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import {
  Mail,
  Paperclip,
  RefreshCw,
  Reply,
  ReplyAll,
  Forward,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";
import type {
  Mailbox,
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
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
import { MailboxSkeleton } from "@/app/(app)/messagerie/_components/mailbox-skeleton";
import {
  useMailboxStore,
  initializeMailboxCache,
  appendMailboxMessages,
  replaceMailboxMessages,
  markMailboxMessageSeen,
} from "@/app/(app)/messagerie/_state/mailbox-store";

type MailboxClientProps = {
  mailbox: Mailbox;
  title: string;
  description: string;
  isConfigured: boolean;
  initialPage: MailboxPageResult | null;
  initialError: string | null;
  emptyStateMessage: string;
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

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 ko";
  }
  const units = ["octets", "ko", "Mo", "Go"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const display = exponent === 0 ? value : value.toFixed(1);
  return `${display} ${units[exponent]}`;
}

export function MailboxClient({
  mailbox,
  title,
  description,
  isConfigured,
  initialPage,
  initialError,
  emptyStateMessage,
}: MailboxClientProps) {
  const { addToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement | null>(null);

  const mailboxState = useMailboxStore((state) => state.mailboxes[mailbox]);

  const [listError, setListError] = useState(initialError);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<
    Record<
      string,
      {
        status: "idle" | "loading" | "ready" | "error";
        url?: string;
        contentType?: string;
      }
    >
  >({});
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] =
    useState<string | null>(null);
  const previewUrlRef = useRef<Record<string, string>>({});

  const pageSizeFromStore =
    mailboxState.pageSize || initialPage?.pageSize || 20;
  const messages = mailboxState.initialized
    ? mailboxState.messages
    : initialPage?.messages ?? [];
  const hasMessages = messages.length > 0;
  const hasMoreMessages = mailboxState.initialized
    ? mailboxState.hasMore
    : initialPage?.hasMore ?? false;

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

  useEffect(() => {
    return () => {
      Object.values(previewUrlRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
      previewUrlRef.current = {};
    };
  }, []);

  useEffect(() => {
    Object.values(previewUrlRef.current).forEach((url) => {
      URL.revokeObjectURL(url);
    });
    previewUrlRef.current = {};
    setAttachmentPreviews({});
    setOpenPreviewId(null);
    setDownloadingAttachmentId(null);
  }, [detail?.uid]);

  const selectedUid = useMemo(() => {
    const raw = searchParams.get("message");
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  useEffect(() => {
    if (mailboxState.initialized) {
      return;
    }

    if (initialPage) {
      initializeMailboxCache(mailbox, {
        messages: initialPage.messages,
        page: initialPage.page,
        pageSize: initialPage.pageSize,
        hasMore: initialPage.hasMore,
        totalMessages: initialPage.totalMessages,
      });
      setListError(initialError);
      return;
    }

    if (initialError) {
      setListError(initialError);
      return;
    }

    let isCancelled = false;
    setInitialLoading(true);
    const loadInitial = async () => {
      const result = await safeActionCall(() =>
        fetchMailboxPageAction({
          mailbox,
          page: 1,
          pageSize: pageSizeFromStore,
        }),
      );
      if (!result || isCancelled) {
        setInitialLoading(false);
        if (!result) {
          setListError("Erreur de synchronisation des messages.");
        }
        return;
      }
      if (result.success) {
        initializeMailboxCache(mailbox, {
          messages: result.data.messages,
          page: result.data.page,
          pageSize: result.data.pageSize,
          hasMore: result.data.hasMore,
          totalMessages: result.data.totalMessages,
        });
        setListError(null);
      } else {
        setListError(result.message);
      }
      setInitialLoading(false);
    };

    void loadInitial();

    return () => {
      isCancelled = true;
    };
  }, [
    mailbox,
    mailboxState.initialized,
    initialPage,
    initialError,
    pageSizeFromStore,
    safeActionCall,
  ]);

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
        if (!result || isCancelled) return;
        if (result.success) {
          setDetail(result.data);
          markMailboxMessageSeen(mailbox, selectedUid);
        } else {
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
  }, [mailbox, selectedUid, safeActionCall, addToast]);

  const handleSelectMessage = useCallback(
    (uid: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("message", String(uid));
      router.replace(`${pathname}?${params.toString()}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const handleClearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("message");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

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
    if (loadingMore || !hasMoreMessages) {
      return;
    }
    setLoadingMore(true);
    const nextPage = mailboxState.page + 1;
    const result = await safeActionCall(() =>
      fetchMailboxPageAction({
        mailbox,
        page: nextPage,
        pageSize: pageSizeFromStore,
      }),
    );
    setLoadingMore(false);
    if (!result) return;
    if (!result.success) {
      addToast({
        variant: "error",
        title: result.message,
      });
      return;
    }
    appendMailboxMessages(mailbox, result.data.messages, {
      page: result.data.page,
      pageSize: result.data.pageSize,
      hasMore: result.data.hasMore,
      totalMessages: result.data.totalMessages,
      lastSync: Date.now(),
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const result = await safeActionCall(() =>
      fetchMailboxPageAction({
        mailbox,
        page: 1,
        pageSize: pageSizeFromStore,
      }),
    );
    setRefreshing(false);
    if (!result) return;
    if (!result.success) {
      addToast({
        variant: "error",
        title: result.message,
      });
      setListError(result.message);
      return;
    }
    replaceMailboxMessages(mailbox, {
      messages: result.data.messages,
      page: result.data.page,
      pageSize: result.data.pageSize,
      hasMore: result.data.hasMore,
      totalMessages: result.data.totalMessages,
    });
    setListError(null);
    addToast({
      variant: "success",
      title: "Messages actualisés.",
    });
    if (listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const showInitialSkeleton =
    !mailboxState.initialized && !initialPage && (initialLoading || !hasMessages);

  const handleDownloadAttachment = useCallback(
    async (attachment: MessageDetail["attachments"][number]) => {
      if (!detail) {
        return;
      }
      const attachmentId = attachment.id;
      const downloadUrl = `/api/messagerie/attachments/${mailbox}/${detail.uid}/${encodeURIComponent(attachmentId)}`;

      setDownloadingAttachmentId(attachmentId);
      try {
        const response = await fetch(downloadUrl, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = attachment.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        console.error("Attachment download failed:", error);
        addToast({
          variant: "error",
          title: "Échec du téléchargement de la pièce jointe.",
        });
      } finally {
        setDownloadingAttachmentId((current) =>
          current === attachmentId ? null : current,
        );
      }
    },
    [addToast, detail, mailbox],
  );

  const handlePreviewAttachment = useCallback(
    async (attachment: MessageDetail["attachments"][number]) => {
      if (!detail) {
        return;
      }
      const attachmentId = attachment.id;
      if (openPreviewId === attachmentId) {
        setOpenPreviewId(null);
        return;
      }

      const current = attachmentPreviews[attachmentId];
      if (current?.status === "loading") {
        return;
      }
      if (current?.status === "ready") {
        setOpenPreviewId(attachmentId);
        return;
      }

      setAttachmentPreviews((prev) => ({
        ...prev,
        [attachmentId]: { status: "loading" },
      }));

      const previewUrl = `/api/messagerie/attachments/${mailbox}/${detail.uid}/${encodeURIComponent(attachmentId)}?inline=1`;

      try {
        const response = await fetch(previewUrl, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (previewUrlRef.current[attachmentId]) {
          URL.revokeObjectURL(previewUrlRef.current[attachmentId]);
        }
        previewUrlRef.current[attachmentId] = objectUrl;

        setAttachmentPreviews((prev) => ({
          ...prev,
          [attachmentId]: {
            status: "ready",
            url: objectUrl,
            contentType: blob.type || attachment.contentType,
          },
        }));
        setOpenPreviewId(attachmentId);
      } catch (error) {
        console.error("Attachment preview failed:", error);
        setAttachmentPreviews((prev) => ({
          ...prev,
          [attachmentId]: { status: "error" },
        }));
        setOpenPreviewId((currentOpen) =>
          currentOpen === attachmentId ? null : currentOpen,
        );
        addToast({
          variant: "error",
          title: "Échec du chargement de la pièce jointe.",
        });
      }
    },
    [addToast, attachmentPreviews, detail, mailbox, openPreviewId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleRefresh}
            loading={refreshing}
            disabled={!isConfigured}
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
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
            ) : showInitialSkeleton ? (
              <MailboxSkeleton rows={6} />
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
                                À : {message.to.slice(0, 3).join(", ")}
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
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {loadingMore ? <MailboxSkeleton rows={3} /> : null}

                {hasMoreMessages ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
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

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {detailLoading ? (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            ) : detailError ? (
              <div className="space-y-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {detailError}
                </p>
                <Button type="button" variant="outline" onClick={handleClearSelection}>
                  Retour à la liste
                </Button>
              </div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {detail.subject}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Reçu le {formatDate(detail.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOpenComposer("reply")}
                    >
                      <Reply className="h-4 w-4" />
                      Répondre
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOpenComposer("reply_all")}
                    >
                      <ReplyAll className="h-4 w-4" />
                      Répondre à tous
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleOpenComposer("forward")}
                    >
                      <Forward className="h-4 w-4" />
                      Transférer
                    </Button>
                  </div>
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
                    <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {detail.attachments.map((attachment) => {
                        const previewEntry =
                          attachmentPreviews[attachment.id];
                        const canPreview =
                          attachment.contentType.startsWith("image/") ||
                          attachment.contentType === "application/pdf";
                        const isPreviewReady =
                          openPreviewId === attachment.id &&
                          previewEntry?.status === "ready" &&
                          previewEntry.url;

                        return (
                          <li
                            key={attachment.id}
                            className="space-y-3 rounded-md border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-zinc-400" />
                                <div>
                                  <p className="font-medium text-zinc-800 dark:text-zinc-200">
                                    {attachment.filename}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                    {attachment.contentType} · {formatFileSize(attachment.size)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {canPreview ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="px-2"
                                    onClick={() =>
                                      void handlePreviewAttachment(attachment)
                                    }
                                    loading={previewEntry?.status === "loading"}
                                  >
                                    {openPreviewId === attachment.id ? (
                                      <>
                                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                                        <span className="sr-only">
                                          Masquer la prévisualisation
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-4 w-4" aria-hidden="true" />
                                        <span className="sr-only">
                                          Prévisualiser la pièce jointe
                                        </span>
                                      </>
                                    )}
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="px-2"
                                  onClick={() =>
                                    void handleDownloadAttachment(attachment)
                                  }
                                  loading={downloadingAttachmentId === attachment.id}
                                >
                                  <Download className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">
                                    Télécharger la pièce jointe
                                  </span>
                                </Button>
                              </div>
                            </div>
                            {isPreviewReady ? (
                              <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
                                {attachment.contentType.startsWith("image/") ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={previewEntry.url}
                                    alt={attachment.filename}
                                    className="max-h-[480px] w-full bg-zinc-100 object-contain dark:bg-zinc-900"
                                  />
                                ) : (
                                  <iframe
                                    src={previewEntry.url}
                                    title={attachment.filename}
                                    className="h-96 w-full"
                                  />
                                )}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <p>Sélectionnez un message pour afficher son contenu.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
