"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import {
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  Reply,
  ReplyAll,
  Forward,
  Download,
  Eye,
  EyeOff,
  Trash2,
  ShieldAlert,
  Undo2,
  FolderSymlink,
  List,
  MailOpen,
  ArrowLeft,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import type {
  Mailbox,
  MailboxListItem,
  MailboxPageResult,
  MailboxSearchResult,
  MessageDetail,
} from "@/server/messaging";
import type { MessagingLocalSyncOverview } from "@/server/messaging-local-sync";
import {
  fetchMailboxPageAction,
  fetchMessageDetailAction,
  moveMailboxMessageAction,
  searchMailboxMessagesAction,
  summarizeMessageWithAiAction,
  triggerMailboxLocalSyncAction,
  updateMailboxMessageSeenStateAction,
  type ActionResult,
} from "@/app/(app)/messagerie/actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import { MailboxSkeleton } from "@/app/(app)/messagerie/_components/mailbox-skeleton";
import { useTheme } from "@/components/theme/theme-provider";
import {
  isMailboxSearchQueryUsable,
  isMailboxSearchable,
  normalizeMailboxSearchQuery,
} from "@/lib/messaging/mailbox-search";
import { canApplyPathScopedNavigationUpdate } from "@/lib/path-scoped-navigation";
import {
  useMailboxStore,
  getMailboxStoreSnapshot,
  initializeMailboxCache,
  appendMailboxMessages,
  replaceMailboxMessages,
  markMailboxMessageSeen,
  removeMailboxMessage,
  invalidateMailboxCache,
  MAILBOX_CACHE_TTL_MS,
  MAILBOX_DETAIL_TTL_MS,
  beginMailboxSync,
  endMailboxSync,
  cacheMessageDetail,
  getCachedMessageDetail,
  shouldReconcileMailboxPage,
} from "@/app/(app)/messagerie/_state/mailbox-store";
import type { LucideIcon } from "lucide-react";

type MailboxClientProps = {
  mailbox: Mailbox;
  title: string;
  description: string;
  isConfigured: boolean;
  localSyncOverview: MessagingLocalSyncOverview;
  initialPage: MailboxPageResult | null;
  initialError: string | null;
  initialSearchPage?: MailboxSearchResult | null;
  initialSearchError?: string | null;
  initialSearchQuery?: string;
  emptyStateMessage: string;
};

const MAILBOX_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }
  return MAILBOX_DATE_FORMATTER.format(date);
}

function getLocalSyncStatusLabel(status: string): string {
  switch (status) {
    case "READY":
      return "Prêt";
    case "DEGRADED":
      return "Dégradé";
    case "BOOTSTRAPPING":
      return "Bootstrap";
    case "ERROR":
      return "Erreur";
    default:
      return "Inactif";
  }
}

function getLocalSyncStatusVariant(
  status: string,
): "info" | "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "READY":
      return "success";
    case "DEGRADED":
      return "warning";
    case "BOOTSTRAPPING":
      return "info";
    case "ERROR":
      return "danger";
    default:
      return "neutral";
  }
}

function getLocalSyncModeLabel(mode: MessagingLocalSyncOverview["mode"]): string {
  switch (mode) {
    case "local-ready":
      return "Lecture locale active";
    case "local-partial":
      return "Lecture locale partielle";
    case "local-bootstrapping":
      return "Bootstrap local en cours";
    default:
      return "IMAP direct (défaut)";
  }
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 ko";
  }
  const units = ["octets", "ko", "Mo", "Go"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;
  const display = exponent === 0 ? value : value.toFixed(1);
  return `${display} ${units[exponent]}`;
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function mergeSearchMessages(
  existing: MailboxListItem[],
  additions: MailboxListItem[],
) {
  if (!existing.length) {
    return additions;
  }
  if (!additions.length) {
    return existing;
  }
  const seen = new Set(existing.map((item) => item.uid));
  return [
    ...existing,
    ...additions.filter((item) => !seen.has(item.uid)),
  ];
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function areTrackingSummariesEqual(
  left: MailboxListItem["tracking"],
  right: MailboxListItem["tracking"],
) {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return left === right;
  }
  return (
    left.enabled === right.enabled &&
    left.totalOpens === right.totalOpens &&
    left.totalClicks === right.totalClicks
  );
}

function areMailboxItemsEqual(
  left: MailboxListItem,
  right: MailboxListItem,
) {
  return (
    left.uid === right.uid &&
    left.messageId === right.messageId &&
    left.subject === right.subject &&
    left.from === right.from &&
    left.date === right.date &&
    left.seen === right.seen &&
    left.hasAttachments === right.hasAttachments &&
    areStringArraysEqual(left.to, right.to) &&
    areTrackingSummariesEqual(left.tracking, right.tracking)
  );
}

type MoveOption = {
  target: Mailbox;
  label: string;
  variant: ButtonProps["variant"];
  icon?: LucideIcon;
  className?: string;
};

const MAILBOX_MOVE_OPTIONS: Record<Mailbox, MoveOption[]> = {
  inbox: [
    {
      target: "trash",
      label: "Corbeille",
      variant: "ghost",
      icon: Trash2,
      className:
        "border border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-500/10",
    },
    {
      target: "spam",
      label: "Spam",
      variant: "ghost",
      icon: ShieldAlert,
      className:
        "border border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-500/10",
    },
  ],
  sent: [
    {
      target: "trash",
      label: "Corbeille",
      variant: "ghost",
      icon: Trash2,
      className:
        "border border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-500/10",
    },
  ],
  drafts: [
    {
      target: "trash",
      label: "Corbeille",
      variant: "ghost",
      icon: Trash2,
      className:
        "border border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-500/10",
    },
  ],
  trash: [
    {
      target: "inbox",
      label: "Restaurer dans Reçus",
      variant: "secondary",
      icon: Undo2,
    },
    {
      target: "spam",
      label: "Marquer comme spam",
      variant: "secondary",
      icon: ShieldAlert,
    },
  ],
  spam: [
    {
      target: "inbox",
      label: "Déplacer vers Reçus",
      variant: "secondary",
      icon: Undo2,
    },
    {
      target: "trash",
      label: "Corbeille",
      variant: "ghost",
      icon: Trash2,
      className:
        "border border-red-500 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-500/10",
    },
  ],
};

const MOVE_SUCCESS_MESSAGES: Partial<Record<Mailbox, string>> = {
  trash: "Message déplacé vers la corbeille.",
  spam: "Message marqué comme spam.",
  inbox: "Message restauré dans Reçus.",
};

type DetailRequestResult = {
  success: boolean;
  detail: MessageDetail | null;
  errorMessage?: string;
};

const MAIL_DETAIL_COLOR_SELECTOR = [
  '[style*="color" i]',
  "font[color]",
  "span[color]",
  "p[color]",
  "div[color]",
  "li[color]",
  "td[color]",
  "th[color]",
  "a[color]",
  "strong[color]",
  "em[color]",
  "b[color]",
  "i[color]",
  "label[color]",
  "small[color]",
].join(", ");

const DARK_MODE_PATCHED_ATTR = "data-dark-mode-color-patched";
const DARK_MODE_SAFE_TEXT = "rgb(244, 244, 245)";
const DARK_COLOR_LUMINANCE_THRESHOLD = 0.32;

const parseRgbChannels = (
  color: string
): [number, number, number] | null => {
  const match = color.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i
  );
  if (!match) {
    return null;
  }
  const [, r, g, b] = match;
  return [Number(r), Number(g), Number(b)];
};

const relativeLuminance = ([r, g, b]: [number, number, number]) => {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const [rLin, gLin, bLin] = [channel(r), channel(g), channel(b)];
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
};

const shouldForceLightColor = (color: string) => {
  const channels = parseRgbChannels(color);
  if (!channels) {
    return false;
  }
  return relativeLuminance(channels) < DARK_COLOR_LUMINANCE_THRESHOLD;
};

const applyDarkModeColorOverrides = (root: HTMLElement) => {
  if (typeof window === "undefined") {
    return;
  }
  const elements =
    root.querySelectorAll<HTMLElement>(MAIL_DETAIL_COLOR_SELECTOR);
  elements.forEach((element) => {
    if (element.dataset.darkModeColorPatched === "1") {
      return;
    }
    const computedColor = window.getComputedStyle(element).color;
    if (!shouldForceLightColor(computedColor)) {
      return;
    }
    element.dataset.darkModeColorPatched = "1";
    element.dataset.darkModeOriginalColorValue =
      element.style.getPropertyValue("color");
    element.dataset.darkModeOriginalColorPriority =
      element.style.getPropertyPriority("color") ?? "";
    element.style.setProperty("color", DARK_MODE_SAFE_TEXT, "important");
  });
};

const restoreDarkModeColorOverrides = (root: HTMLElement) => {
  const patched = root.querySelectorAll<HTMLElement>(
    `[${DARK_MODE_PATCHED_ATTR}="1"]`
  );
  patched.forEach((element) => {
    const originalValue =
      element.dataset.darkModeOriginalColorValue ?? "";
    const originalPriority =
      element.dataset.darkModeOriginalColorPriority ?? "";
    if (originalValue) {
      element.style.setProperty(
        "color",
        originalValue,
        originalPriority || undefined
      );
    } else {
      element.style.removeProperty("color");
    }
    delete element.dataset.darkModeColorPatched;
    delete element.dataset.darkModeOriginalColorValue;
    delete element.dataset.darkModeOriginalColorPriority;
  });
};

type MobilePane = "list" | "detail";

const MOBILE_PANE_TABS: Array<{
  key: MobilePane;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "list", label: "Liste", icon: List },
  { key: "detail", label: "Lecture", icon: MailOpen },
];

const MAILBOX_PATHNAMES: Record<Mailbox, string> = {
  inbox: "/messagerie/recus",
  sent: "/messagerie/envoyes",
  drafts: "/messagerie/brouillons",
  trash: "/messagerie/corbeille",
  spam: "/messagerie/spam",
};

const SUBJECT_CLAMP_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const MAILBOX_RENDER_BATCH_SIZE = 60;
const MAILBOX_SELECTION_VISIBILITY_BUFFER = 12;
const MAILBOX_DETAIL_PREFETCH_BATCH_SIZE = 3;
const MAILBOX_DETAIL_PREFETCH_DELAY_MS = 150;

function collectLikelyDetailPrefetchUids(
  messages: MailboxListItem[],
  selectedUid: number | null,
  maxCount: number,
) {
  if (!messages.length || maxCount <= 0) {
    return [];
  }

  const candidates: number[] = [];
  const selectedIndex =
    selectedUid === null
      ? -1
      : messages.findIndex((message) => message.uid === selectedUid);

  if (selectedIndex >= 0) {
    candidates.push(messages[selectedIndex]!.uid);
    if (messages[selectedIndex + 1]) {
      candidates.push(messages[selectedIndex + 1]!.uid);
    }
    if (messages[selectedIndex - 1]) {
      candidates.push(messages[selectedIndex - 1]!.uid);
    }
  }

  for (const message of messages) {
    if (candidates.length >= maxCount) {
      break;
    }
    candidates.push(message.uid);
  }

  return Array.from(new Set(candidates)).slice(0, maxCount);
}

function MessageDetailSkeleton() {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="space-y-3 rounded-lg border border-zinc-200/70 bg-zinc-50 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/40">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-4 w-3/6" />
      </div>
    </div>
  );
}

type MailboxMessageRowProps = {
  mailbox: Mailbox;
  message: MailboxListItem;
  isActive: boolean;
  isLoadingSelection: boolean;
  onSelect: (uid: number) => void;
  onWarm: (uid: number) => void;
};

const MailboxMessageRow = memo(function MailboxMessageRow({
  mailbox,
  message,
  isActive,
  isLoadingSelection,
  onSelect,
  onWarm,
}: MailboxMessageRowProps) {
  const disableSelection = isLoadingSelection && isActive;
  const formattedDate = formatDate(message.date);
  const hasRecipients = message.to.length > 0;
  const recipientsPreview = hasRecipients
    ? message.to.slice(0, 3).join(", ")
    : "";
  const recipientsOverflow = hasRecipients && message.to.length > 3;

  return (
    <button
      data-message-uid={message.uid}
      type="button"
      onClick={() => onSelect(message.uid)}
      onMouseEnter={() => onWarm(message.uid)}
      onFocus={() => onWarm(message.uid)}
      disabled={disableSelection}
      aria-busy={isLoadingSelection ? "true" : undefined}
      className={clsx(
        "w-full rounded-lg border px-3 py-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:focus-visible:ring-offset-zinc-900",
        isActive
          ? "border-blue-300 bg-blue-50 text-blue-800 ring-1 ring-blue-200 dark:border-blue-500/60 dark:bg-blue-500/20 dark:text-blue-100 dark:ring-blue-400/40"
          : "border-zinc-200 bg-white text-zinc-800 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-500/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-100"
      )}
      aria-current={isActive ? "true" : undefined}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <div className="min-w-0 flex-1 space-y-1">
            <p
              className={clsx(
                "text-sm font-semibold leading-tight",
                message.seen
                  ? "text-current"
                  : "text-blue-600 dark:text-blue-200"
              )}
            >
              <span
                className="block break-words"
                style={SUBJECT_CLAMP_STYLE}
              >
                {message.subject || "(Sans objet)"}
              </span>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <span className="block truncate">
                {message.from || "Expéditeur inconnu"}
              </span>
            </p>
          </div>
          <div className="flex flex-none flex-col items-start text-[11px] font-medium text-zinc-500 dark:text-zinc-400 sm:items-end sm:text-xs">
            <span className="flex items-center gap-1 leading-tight tabular-nums">
              {isLoadingSelection ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-200"
                  aria-hidden="true"
                />
              ) : null}
              {formattedDate}
            </span>
            {!message.seen ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                Nouveau
              </span>
            ) : null}
          </div>
        </div>
        {hasRecipients ? (
          <p className="text-xs leading-snug text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-600 dark:text-zinc-300">
              À :
            </span>{" "}
            <span className="break-words">
              {recipientsPreview}
              {recipientsOverflow ? "…" : ""}
            </span>
          </p>
        ) : null}
        {mailbox === "sent" ? (
          <p className="text-xs leading-snug text-zinc-500 dark:text-zinc-400">
            {message.tracking
              ? message.tracking.enabled
                ? `${formatCount(
                    message.tracking.totalOpens,
                    "ouverture",
                    "ouvertures"
                  )} · ${formatCount(
                    message.tracking.totalClicks,
                    "clic",
                    "clics"
                  )}`
                : "Suivi désactivé lors de l'envoi"
              : "Suivi non disponible"}
          </p>
        ) : null}
        {message.hasAttachments ? (
          <Badge
            variant="info"
            className="w-fit text-[11px]"
          >
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Pièces jointes
            </span>
          </Badge>
        ) : null}
      </div>
    </button>
  );
}, (previous, next) => {
  return (
    previous.mailbox === next.mailbox &&
    areMailboxItemsEqual(previous.message, next.message) &&
    previous.isActive === next.isActive &&
    previous.isLoadingSelection === next.isLoadingSelection &&
    previous.onSelect === next.onSelect &&
    previous.onWarm === next.onWarm
  );
});

export function MailboxClient({
  mailbox,
  title,
  description,
  isConfigured,
  localSyncOverview,
  initialPage,
  initialError,
  initialSearchPage = null,
  initialSearchError = null,
  initialSearchQuery = "",
  emptyStateMessage,
}: MailboxClientProps) {
  const { addToast } = useToast();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname() ?? MAILBOX_PATHNAMES[mailbox];
  const pagePathnameRef = useRef(pathname);
  const pagePathname = pagePathnameRef.current;
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement | null>(null);
  const detailPaneRef = useRef<HTMLDivElement | null>(null);
  const mailDetailBodyRef = useRef<HTMLDivElement | null>(null);
  const detailRequestsRef = useRef<Map<string, Promise<DetailRequestResult>>>(
    new Map()
  );
  const prefetchedDetailStateRef = useRef<Map<number, "pending" | "done">>(
    new Map()
  );
  const seenWritebackStateRef = useRef<Map<string, "pending" | "done">>(
    new Map()
  );
  const initialLoadAttemptedRef = useRef(false);
  const searchRequestIdRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const appliedInitialPageRef = useRef<string | null>(null);

  const mailboxState = useMailboxStore((state) => state.mailboxes[mailbox]);
  const searchEnabled = isMailboxSearchable(mailbox);
  const normalizedInitialSearchQuery = searchEnabled
    ? normalizeMailboxSearchQuery(initialSearchQuery)
    : "";
  const initialCommittedSearchQuery =
    searchEnabled && isMailboxSearchQueryUsable(normalizedInitialSearchQuery)
      ? normalizedInitialSearchQuery
      : "";
  const initialResolvedSearchPage =
    initialSearchPage &&
    initialSearchPage.query === initialCommittedSearchQuery
      ? initialSearchPage
      : null;
  const initialResolvedSearchError = initialCommittedSearchQuery
    ? initialSearchError
    : null;

  const [listError, setListError] = useState(initialError);
  const [searchInput, setSearchInput] = useState(
    normalizedInitialSearchQuery
  );
  const [committedSearchQuery, setCommittedSearchQuery] = useState(
    initialCommittedSearchQuery
  );
  const [searchResult, setSearchResult] = useState<MailboxSearchResult | null>(
    initialResolvedSearchPage
  );
  const [searchError, setSearchError] = useState<string | null>(
    initialResolvedSearchError
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const aiSummaryRequestIdRef = useRef(0);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryVisible, setAiSummaryVisible] = useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
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
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [movingTarget, setMovingTarget] = useState<Mailbox | null>(null);
  const previewUrlRef = useRef<Record<string, string>>({});
  const staleRefreshPendingRef = useRef(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [visibleMessageCount, setVisibleMessageCount] = useState(
    MAILBOX_RENDER_BATCH_SIZE
  );
  const mobilePaneInitializedRef = useRef(false);
  const listPaneId = `${mailbox}-mailbox-list-pane`;
  const detailPaneId = `${mailbox}-mailbox-detail-pane`;

  useEffect(() => {
    setStoreHydrated(true);
  }, []);

  useEffect(() => {
    setSearchInput(normalizedInitialSearchQuery);
    setCommittedSearchQuery(initialCommittedSearchQuery);
    setSearchResult(initialResolvedSearchPage);
    setSearchError(initialResolvedSearchError);
    setSearchLoading(false);
    setSearchLoadingMore(false);
    searchRequestIdRef.current += 1;
  }, [
    initialCommittedSearchQuery,
    initialResolvedSearchError,
    initialResolvedSearchPage,
    normalizedInitialSearchQuery,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopLayout(event.matches);
    };
    setIsDesktopLayout(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }
    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    detailRequestsRef.current.clear();
    prefetchedDetailStateRef.current.clear();
    seenWritebackStateRef.current.clear();
  }, [mailbox]);

  useEffect(() => {
    setVisibleMessageCount(MAILBOX_RENDER_BATCH_SIZE);
  }, [committedSearchQuery, mailbox]);

  useEffect(() => {
    aiSummaryRequestIdRef.current += 1;
    setAiSummary(null);
    setAiSummaryVisible(false);
    setAiSummaryError(null);
    setAiSummaryLoading(false);
  }, [detail?.uid, mailbox]);

  const storeHasMessages = storeHydrated && mailboxState.messages.length > 0;
  const preferStoreState =
    storeHydrated && (mailboxState.initialized || storeHasMessages);
  const pageSizeFromStore = preferStoreState
    ? mailboxState.pageSize
    : initialPage?.pageSize ?? 20;
  const messages = useMemo(
    () =>
      preferStoreState ? mailboxState.messages : initialPage?.messages ?? [],
    [initialPage, mailboxState.messages, preferStoreState]
  );
  const hasActiveSearch =
    isConfigured &&
    searchEnabled &&
    isMailboxSearchQueryUsable(committedSearchQuery);
  const hasMessages = messages.length > 0;
  const hasMoreMessages = preferStoreState
    ? mailboxState.hasMore
    : initialPage?.hasMore ?? false;
  const displayedMessages = useMemo(
    () => (hasActiveSearch ? searchResult?.messages ?? [] : messages),
    [hasActiveSearch, messages, searchResult]
  );
  const currentLocalSyncMailbox = useMemo(
    () =>
      localSyncOverview.mailboxes.find((entry) => entry.mailbox === mailbox) ??
      null,
    [localSyncOverview.mailboxes, mailbox]
  );
  const canWarmMessageDetailLocally = Boolean(
    localSyncOverview.active &&
      currentLocalSyncMailbox?.readable &&
      currentLocalSyncMailbox.backfillComplete
  );
  const displayedHasMessages = displayedMessages.length > 0;
  const displayedHasMoreMessages = hasActiveSearch
    ? searchResult?.hasMore ?? false
    : hasMoreMessages;
  const displayedLoadingMore = hasActiveSearch
    ? searchLoadingMore
    : loadingMore;
  const initialPageKey = useMemo(() => {
    if (!initialPage) {
      return null;
    }
    return JSON.stringify({
      mailbox,
      page: initialPage.page,
      pageSize: initialPage.pageSize,
      hasMore: initialPage.hasMore,
      totalMessages: initialPage.totalMessages,
      messages: initialPage.messages.map((message) => ({
        uid: message.uid,
        messageId: message.messageId,
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
        seen: message.seen,
        hasAttachments: message.hasAttachments,
        tracking: message.tracking ?? null,
      })),
    });
  }, [initialPage, mailbox]);

  const safeActionCall = useCallback(
    async <T,>(
      action: () => Promise<ActionResult<T>>,
      options?: { silentNetworkError?: boolean }
    ): Promise<ActionResult<T> | null> => {
      try {
        return await action();
      } catch (error) {
        console.error("Erreur réseau lors de l'appel à une action:", error);
        if (!options?.silentNetworkError) {
          addToast({
            variant: "error",
            title: "Erreur réseau.",
          });
        }
        return null;
      }
    },
    [addToast]
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

  useEffect(() => {
    const root = mailDetailBodyRef.current;
    if (!root) {
      return;
    }
    if (resolvedTheme !== "dark") {
      restoreDarkModeColorOverrides(root);
      return;
    }
    applyDarkModeColorOverrides(root);
  }, [detail?.html, detail?.uid, resolvedTheme]);

  const initialSelectedUid = useMemo(() => {
    const raw = searchParams.get("message");
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);
  const [selectedUid, setSelectedUid] = useState<number | null>(
    initialSelectedUid
  );
  const [optimisticSelectedUid, setOptimisticSelectedUid] = useState<
    number | null
  >(initialSelectedUid);
  const [pendingMessageUid, setPendingMessageUid] = useState<number | null>(
    null
  );
  const updateUrlMailboxParams = useCallback(
    ({
      message,
      q,
    }: {
      message?: number | null;
      q?: string | null;
    }) => {
      if (typeof window === "undefined") {
        return;
      }
      const currentHref = window.location.href;
      const url = new URL(currentHref);
      if (typeof message !== "undefined") {
        if (message !== null) {
          url.searchParams.set("message", String(message));
        } else {
          url.searchParams.delete("message");
        }
      }
      if (typeof q !== "undefined") {
        const normalizedQuery = normalizeMailboxSearchQuery(q);
        if (normalizedQuery.length > 0) {
          url.searchParams.set("q", normalizedQuery);
        } else {
          url.searchParams.delete("q");
        }
      }
      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      if (
        !canApplyPathScopedNavigationUpdate({
          currentHref,
          ownedPathname: pagePathname,
          nextHref: nextPath,
        })
      ) {
        return;
      }
      window.history.replaceState(window.history.state, "", nextPath);
    },
    [pagePathname]
  );
  const activeUrlSearchQuery =
    searchEnabled && isMailboxSearchQueryUsable(committedSearchQuery)
      ? committedSearchQuery
      : null;
  const normalizedSearchInput = normalizeMailboxSearchQuery(searchInput);
  const canSubmitSearch =
    searchEnabled && isMailboxSearchQueryUsable(normalizedSearchInput);
  const hasPendingSearchDraft =
    normalizedSearchInput !== committedSearchQuery;
  const updateUrlMessageParam = useCallback(
    (uid: number | null) => {
      updateUrlMailboxParams({
        message: uid,
        q: activeUrlSearchQuery,
      });
    },
    [activeUrlSearchQuery, updateUrlMailboxParams]
  );

  useEffect(() => {
    if (!searchEnabled) {
      return;
    }
    updateUrlMailboxParams({
      q: committedSearchQuery || null,
    });
  }, [committedSearchQuery, searchEnabled, updateUrlMailboxParams]);

  useEffect(() => {
    setSelectedUid(initialSelectedUid);
    setOptimisticSelectedUid(initialSelectedUid);
    if (!initialSelectedUid) {
      setPendingMessageUid(null);
    }
  }, [initialSelectedUid]);

  useEffect(() => {
    setOptimisticSelectedUid(selectedUid);
    if (!selectedUid) {
      setPendingMessageUid(null);
    }
  }, [selectedUid]);

  useEffect(() => {
    if (!mobilePaneInitializedRef.current) {
      mobilePaneInitializedRef.current = true;
      if (selectedUid) {
        setMobilePane("detail");
      }
      return;
    }
    if (!selectedUid && mobilePane === "detail") {
      setMobilePane("list");
    }
  }, [mobilePane, selectedUid]);

  useEffect(() => {
    if (mobilePane !== "detail" || isDesktopLayout) {
      return;
    }
    detailPaneRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [isDesktopLayout, mobilePane]);

  const cachedDetailEntry = useMailboxStore(
    useCallback(
      (state) => {
        if (!selectedUid) {
          return null;
        }
        return state.messageDetails[mailbox]?.[selectedUid] ?? null;
      },
      [mailbox, selectedUid]
    )
  );

  const cachedDetail =
    cachedDetailEntry &&
    Date.now() - cachedDetailEntry.fetchedAt <= MAILBOX_DETAIL_TTL_MS
      ? cachedDetailEntry.detail
      : null;
  const selectedMessageListItem = useMemo(() => {
    if (!selectedUid) {
      return null;
    }
    return (
      displayedMessages.find((message) => message.uid === selectedUid) ??
      null
    );
  }, [displayedMessages, selectedUid]);
  const selectedDisplayedMessageIndex = useMemo(() => {
    if (!selectedUid) {
      return -1;
    }
    return displayedMessages.findIndex((message) => message.uid === selectedUid);
  }, [displayedMessages, selectedUid]);
  const resolvedVisibleMessageCount = useMemo(() => {
    const baselineCount = Math.min(
      displayedMessages.length,
      visibleMessageCount
    );
    if (selectedDisplayedMessageIndex < 0) {
      return baselineCount;
    }
    return Math.min(
      displayedMessages.length,
      Math.max(
        baselineCount,
        selectedDisplayedMessageIndex + MAILBOX_SELECTION_VISIBILITY_BUFFER
      )
    );
  }, [
    displayedMessages.length,
    selectedDisplayedMessageIndex,
    visibleMessageCount,
  ]);
  const visibleMessages = useMemo(
    () => displayedMessages.slice(0, resolvedVisibleMessageCount),
    [displayedMessages, resolvedVisibleMessageCount]
  );
  const hiddenLoadedMessageCount = Math.max(
    0,
    displayedMessages.length - visibleMessages.length
  );

  const moveOptions = useMemo(
    () => MAILBOX_MOVE_OPTIONS[mailbox] ?? [],
    [mailbox]
  );

  const detailHasSummarizableContent = useMemo(() => {
    if (!detail) {
      return false;
    }
    const plainText = detail.text?.replace(/\s+/g, " ").trim();
    if (plainText?.length) {
      return true;
    }
    const strippedHtml = detail.html
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return Boolean(strippedHtml?.length);
  }, [detail]);

  const processAutoMoved = useCallback(
    (
      entries?: Array<{
        uid: number;
        subject: string;
        from: string | null;
        target?: Mailbox;
        score?: number;
      }>
    ) => {
      if (!entries?.length) {
        return;
      }
      let hasInvalidatedSpam = false;
      entries.forEach((entry) => {
        removeMailboxMessage(mailbox, entry.uid);
        const details: string[] = [];
        if (entry.subject) {
          details.push(`Objet : ${entry.subject}`);
        }
        if (entry.score !== undefined) {
          details.push(`Score spam : ${Math.round(entry.score)}`);
        }
        addToast({
          variant: "warning",
          title: "Déplacé dans les indésirables",
          description: details.length ? details.join(" · ") : undefined,
        });
        if (!hasInvalidatedSpam) {
          invalidateMailboxCache("spam");
          hasInvalidatedSpam = true;
        }
      });
    },
    [addToast, mailbox]
  );

  const removeMessageFromSearchResult = useCallback((uid: number) => {
    setSearchResult((current) => {
      if (!current) {
        return current;
      }
      const nextMessages = current.messages.filter(
        (message) => message.uid !== uid
      );
      if (nextMessages.length === current.messages.length) {
        return current;
      }
      return {
        ...current,
        messages: nextMessages,
        totalMessages: Math.max(0, current.totalMessages - 1),
      };
    });
  }, []);

  const markMessageSeenOptimistically = useCallback(
    (uid: number) => {
      markMailboxMessageSeen(mailbox, uid);
      setSearchResult((current) => {
        if (!current) {
          return current;
        }
        let changed = false;
        const messages = current.messages.map((message) => {
          if (message.uid !== uid || message.seen) {
            return message;
          }
          changed = true;
          return {
            ...message,
            seen: true,
          };
        });
        return changed
          ? {
              ...current,
              messages,
            }
          : current;
      });
      setDetail((current) =>
        current && current.uid === uid && !current.seen
          ? {
              ...current,
              seen: true,
            }
          : current
      );
      const cached = getCachedMessageDetail(mailbox, uid);
      if (cached && !cached.seen) {
        cacheMessageDetail(mailbox, {
          ...cached,
          seen: true,
        });
      }
    },
    [mailbox]
  );

  const queueSeenWriteback = useCallback(
    (uid: number, seen: boolean) => {
      const cacheKey = `${mailbox}:${uid}:${seen ? "seen" : "unseen"}`;
      const currentState = seenWritebackStateRef.current.get(cacheKey);
      if (currentState === "pending" || currentState === "done") {
        return;
      }
      seenWritebackStateRef.current.set(cacheKey, "pending");
      safeActionCall(
        () =>
          updateMailboxMessageSeenStateAction({
            mailbox,
            uid,
            seen,
          }),
        {
          silentNetworkError: true,
        }
      )
        .then((result) => {
          if (!result || !result.success) {
            seenWritebackStateRef.current.delete(cacheKey);
            return;
          }
          seenWritebackStateRef.current.set(cacheKey, "done");
        })
        .catch(() => {
          seenWritebackStateRef.current.delete(cacheKey);
        });
    },
    [mailbox, safeActionCall]
  );

  const requestMessageDetail = useCallback(
    async (
      uid: number,
      options?: { silentNetworkError?: boolean }
    ): Promise<DetailRequestResult> => {
      const cached = getCachedMessageDetail(mailbox, uid);
      if (cached) {
        return {
          success: true,
          detail: cached,
        };
      }
      const cacheKey = `${mailbox}:${uid}`;
      const inflight = detailRequestsRef.current.get(cacheKey);
      if (inflight) {
        return inflight;
      }
      const requestPromise = (async () => {
        const result = await safeActionCall(
          () =>
            fetchMessageDetailAction({
              mailbox,
              uid,
            }),
          options
        );
        if (!result) {
          return {
            success: false,
            detail: null,
            errorMessage: "Erreur réseau lors du chargement du message.",
          };
        }
        if (!result.success || !result.data) {
          return {
            success: false,
            detail: null,
            errorMessage: result.message ?? "Échec de chargement du message.",
          };
        }
        cacheMessageDetail(mailbox, result.data);
        return {
          success: true,
          detail: result.data,
        };
      })();
      detailRequestsRef.current.set(cacheKey, requestPromise);
      requestPromise.finally(() => {
        detailRequestsRef.current.delete(cacheKey);
      });
      return requestPromise;
    },
    [mailbox, safeActionCall]
  );

  const warmMessageDetail = useCallback(
    (
      uid: number | null,
      options?: {
        allowRemote?: boolean;
      }
    ) => {
      if (!uid) {
        return;
      }
      if (getCachedMessageDetail(mailbox, uid)) {
        prefetchedDetailStateRef.current.set(uid, "done");
        return;
      }
      if (!options?.allowRemote && !canWarmMessageDetailLocally) {
        return;
      }
      const currentState = prefetchedDetailStateRef.current.get(uid);
      if (currentState === "pending" || currentState === "done") {
        return;
      }
      prefetchedDetailStateRef.current.set(uid, "pending");
      requestMessageDetail(uid, { silentNetworkError: true })
        .then((result) => {
          if (result.success) {
            prefetchedDetailStateRef.current.set(uid, "done");
          } else {
            prefetchedDetailStateRef.current.delete(uid);
          }
        })
        .catch(() => {
          prefetchedDetailStateRef.current.delete(uid);
        });
    },
    [canWarmMessageDetailLocally, mailbox, requestMessageDetail]
  );

  useEffect(() => {
    if (!canWarmMessageDetailLocally || visibleMessages.length === 0) {
      return;
    }
    const candidateUids = collectLikelyDetailPrefetchUids(
      visibleMessages,
      selectedUid,
      MAILBOX_DETAIL_PREFETCH_BATCH_SIZE
    );
    if (!candidateUids.length) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      candidateUids.forEach((uid) => {
        warmMessageDetail(uid);
      });
    }, MAILBOX_DETAIL_PREFETCH_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    canWarmMessageDetailLocally,
    selectedUid,
    visibleMessages,
    warmMessageDetail,
  ]);

  const loadSearchPage = useCallback(
    async ({
      query,
      page,
      append = false,
      showToastOnError = false,
    }: {
      query: string;
      page: number;
      append?: boolean;
      showToastOnError?: boolean;
    }) => {
      const normalizedQuery = normalizeMailboxSearchQuery(query);
      if (!searchEnabled || !isMailboxSearchQueryUsable(normalizedQuery)) {
        return null;
      }

      const requestId = ++searchRequestIdRef.current;
      if (append) {
        setSearchLoadingMore(true);
      } else {
        setSearchLoading(true);
        setSearchError(null);
        setSearchResult((current) =>
          current?.query === normalizedQuery ? current : null
        );
      }

      const result = await safeActionCall(
        () =>
          searchMailboxMessagesAction({
            mailbox,
            query: normalizedQuery,
            page,
            pageSize: pageSizeFromStore,
          }),
        {
          silentNetworkError: true,
        }
      );

      if (requestId !== searchRequestIdRef.current) {
        return null;
      }

      if (append) {
        setSearchLoadingMore(false);
      } else {
        setSearchLoading(false);
      }

      if (!result) {
        const message = "Erreur réseau lors de la recherche.";
        if (!append) {
          setSearchError(message);
        }
        if (showToastOnError) {
          addToast({
            variant: "error",
            title: message,
          });
        }
        return null;
      }

      if (!result.success || !result.data) {
        const message =
          result.message ?? "Échec de la recherche dans la messagerie.";
        if (!append) {
          setSearchError(message);
        }
        if (showToastOnError) {
          addToast({
            variant: "error",
            title: message,
          });
        }
        return null;
      }

      const data = result.data;
      setSearchError(null);
      setSearchResult((current) => {
        if (!append || !current || current.query !== normalizedQuery) {
          return data;
        }
        return {
          ...data,
          messages: mergeSearchMessages(
            current.messages,
            data.messages
          ),
        };
      });
      if (!append) {
        listRef.current?.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
      return data;
    },
    [
      addToast,
      mailbox,
      pageSizeFromStore,
      safeActionCall,
      searchEnabled,
    ]
  );

  const resetSearchState = useCallback(() => {
    searchRequestIdRef.current += 1;
    setCommittedSearchQuery("");
    setSearchResult(null);
    setSearchError(null);
    setSearchLoading(false);
    setSearchLoadingMore(false);
  }, []);

  const handleSearchSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!searchEnabled) {
        return;
      }
      if (!normalizedSearchInput.length) {
        setMobilePane("list");
        resetSearchState();
        return;
      }
      if (!canSubmitSearch) {
        addToast({
          variant: "warning",
          title: "Saisissez au moins 2 caractères.",
        });
        return;
      }
      setMobilePane("list");
      if (normalizedSearchInput === committedSearchQuery) {
        void loadSearchPage({
          query: normalizedSearchInput,
          page: 1,
          showToastOnError: true,
        });
        return;
      }
      setCommittedSearchQuery(normalizedSearchInput);
    },
    [
      addToast,
      canSubmitSearch,
      committedSearchQuery,
      loadSearchPage,
      normalizedSearchInput,
      resetSearchState,
      searchEnabled,
    ]
  );

  const handleClearSearch = useCallback(() => {
    setMobilePane("list");
    setSearchInput("");
    resetSearchState();
  }, [resetSearchState]);

  useEffect(() => {
    if (!searchEnabled) {
      return;
    }
    if (normalizedSearchInput.length > 0 || !committedSearchQuery.length) {
      return;
    }
    resetSearchState();
  }, [
    committedSearchQuery,
    normalizedSearchInput.length,
    resetSearchState,
    searchEnabled,
  ]);

  useEffect(() => {
    if (!hasActiveSearch) {
      return;
    }
    setMobilePane("list");
    if (
      initialResolvedSearchPage &&
      initialResolvedSearchPage.query === committedSearchQuery &&
      initialResolvedSearchPage.page === 1
    ) {
      setSearchResult(initialResolvedSearchPage);
      setSearchError(initialResolvedSearchError);
      setSearchLoading(false);
      setSearchLoadingMore(false);
      return;
    }
    void loadSearchPage({
      query: committedSearchQuery,
      page: 1,
    });
  }, [
    committedSearchQuery,
    hasActiveSearch,
    initialResolvedSearchError,
    initialResolvedSearchPage,
    loadSearchPage,
  ]);

  useEffect(() => {
    if (!isConfigured) {
      setInitialLoading(false);
      initialLoadAttemptedRef.current = false;
      return;
    }
    if (hasActiveSearch) {
      setInitialLoading(false);
      initialLoadAttemptedRef.current = false;
      return;
    }
    if (!initialPage || !initialPageKey) {
      appliedInitialPageRef.current = null;
      return;
    }
    if (appliedInitialPageRef.current === initialPageKey) {
      return;
    }

    initialLoadAttemptedRef.current = false;
    const payload = {
      messages: initialPage.messages,
      page: initialPage.page,
      pageSize: initialPage.pageSize,
      hasMore: initialPage.hasMore,
      totalMessages: initialPage.totalMessages,
    };
    const currentMailboxState =
      getMailboxStoreSnapshot().mailboxes[mailbox];
    if (shouldReconcileMailboxPage(currentMailboxState, payload)) {
      if (currentMailboxState.initialized) {
        replaceMailboxMessages(mailbox, payload);
      } else {
        initializeMailboxCache(mailbox, payload);
      }
    }
    appliedInitialPageRef.current = initialPageKey;
    setListError(initialError);
  }, [
    hasActiveSearch,
    initialError,
    initialPage,
    initialPageKey,
    isConfigured,
    mailbox,
  ]);

  useEffect(() => {
    if (!isConfigured) {
      setInitialLoading(false);
      initialLoadAttemptedRef.current = false;
      return;
    }
    if (hasActiveSearch) {
      setInitialLoading(false);
      initialLoadAttemptedRef.current = false;
      return;
    }
    if (mailboxState.initialized) {
      initialLoadAttemptedRef.current = false;
      return;
    }

    if (initialError) {
      initialLoadAttemptedRef.current = false;
      setListError(initialError);
      return;
    }

    if (mailboxState.syncing) {
      setInitialLoading(true);
      return;
    }

    if (initialLoadAttemptedRef.current) {
      return;
    }

    let isCancelled = false;
    let released = false;
    const releaseSync = () => {
      if (!released) {
        endMailboxSync(mailbox);
        released = true;
      }
    };

    const acquired = beginMailboxSync(mailbox);
    if (!acquired) {
      setInitialLoading(true);
      return;
    }
    initialLoadAttemptedRef.current = true;
    setInitialLoading(true);
    const loadInitial = async () => {
      try {
        const result = await safeActionCall(() =>
          fetchMailboxPageAction({
            mailbox,
            page: 1,
            pageSize: pageSizeFromStore,
          })
        );
        if (!result) {
          setListError("Erreur de synchronisation des messages.");
          return;
        }
        if (isCancelled) {
          return;
        }
        if (result.success) {
          const payload = result.data;
          if (!payload) {
            setListError("Réponse invalide du serveur.");
            return;
          }
          initializeMailboxCache(mailbox, {
            messages: payload.messages,
            page: payload.page,
            pageSize: payload.pageSize,
            hasMore: payload.hasMore,
            totalMessages: payload.totalMessages,
          });
          processAutoMoved(payload.autoMoved);
          setListError(null);
        } else {
          setListError(result.message);
          addToast({
            variant: "error",
            title: result.message,
          });
        }
      } finally {
        setInitialLoading(false);
        releaseSync();
      }
    };

    void loadInitial();

    return () => {
      isCancelled = true;
      releaseSync();
    };
  }, [
    addToast,
    initialError,
    isConfigured,
    hasActiveSearch,
    mailbox,
    mailboxState.initialized,
    mailboxState.syncing,
    pageSizeFromStore,
    processAutoMoved,
    safeActionCall,
  ]);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }
    if (hasActiveSearch) {
      return;
    }
    if (
      !storeHydrated ||
      !mailboxState.initialized ||
      mailboxState.lastSync === null
    ) {
      return;
    }
    if (Date.now() - mailboxState.lastSync <= MAILBOX_CACHE_TTL_MS) {
      return;
    }
    if (staleRefreshPendingRef.current) {
      return;
    }
    const acquired = beginMailboxSync(mailbox);
    if (!acquired) {
      return;
    }
    staleRefreshPendingRef.current = true;
    let cancelled = false;

    const refreshStaleCache = async () => {
      const result = await safeActionCall(() =>
        fetchMailboxPageAction({
          mailbox,
          page: 1,
          pageSize: pageSizeFromStore,
        })
      );
      if (cancelled) {
        return;
      }
      if (result && result.success && result.data) {
        replaceMailboxMessages(mailbox, {
          messages: result.data.messages,
          page: result.data.page,
          pageSize: result.data.pageSize,
          hasMore: result.data.hasMore,
          totalMessages: result.data.totalMessages,
        });
        processAutoMoved(result.data.autoMoved);
        setListError(null);
      }
    };

    void refreshStaleCache().finally(() => {
      staleRefreshPendingRef.current = false;
      endMailboxSync(mailbox);
    });

    return () => {
      cancelled = true;
    };
  }, [
    hasActiveSearch,
    isConfigured,
    mailbox,
    mailboxState.initialized,
    mailboxState.lastSync,
    pageSizeFromStore,
    processAutoMoved,
    safeActionCall,
    storeHydrated,
  ]);

  useEffect(() => {
    if (!selectedUid) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      setPendingMessageUid(null);
      return;
    }

    const shouldWriteSeen =
      selectedMessageListItem?.seen === false ||
      (!selectedMessageListItem && cachedDetail?.seen === false);

    if (cachedDetail) {
      setDetail(cachedDetail);
      setDetailError(null);
      setDetailLoading(false);
      if (shouldWriteSeen) {
        markMessageSeenOptimistically(selectedUid);
        queueSeenWriteback(selectedUid, true);
      }
      setPendingMessageUid((current) =>
        current === selectedUid ? null : current
      );
      return;
    }

    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);

    const loadDetail = async () => {
      const result = await requestMessageDetail(selectedUid);
      if (cancelled) {
        return;
      }
      if (result.success && result.detail) {
        setDetail(result.detail);
        setDetailError(null);
        if (shouldWriteSeen || result.detail.seen === false) {
          markMessageSeenOptimistically(selectedUid);
          queueSeenWriteback(selectedUid, true);
        }
      } else {
        const errorMessage =
          result.errorMessage ?? "Échec de chargement du message.";
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
      setPendingMessageUid((current) =>
        current === selectedUid ? null : current
      );
      setDetailLoading(false);
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [
    addToast,
    cachedDetail,
    markMessageSeenOptimistically,
    queueSeenWriteback,
    requestMessageDetail,
    selectedMessageListItem,
    selectedUid,
  ]);

  const handleSelectMessage = useCallback(
    (uid: number) => {
      if (detailLoading && optimisticSelectedUid === uid) {
        return;
      }
      setPendingMessageUid(uid);
      setOptimisticSelectedUid(uid);
      setSelectedUid(uid);
      updateUrlMessageParam(uid);
      warmMessageDetail(uid, { allowRemote: true });
      setMobilePane("detail");
    },
    [
      detailLoading,
      optimisticSelectedUid,
      updateUrlMessageParam,
      warmMessageDetail,
    ]
  );

  const handleClearSelection = useCallback(() => {
    updateUrlMessageParam(null);
    setSelectedUid(null);
    setMobilePane("list");
    setOptimisticSelectedUid(null);
    setPendingMessageUid(null);
    setDetail(null);
    setDetailError(null);
  }, [updateUrlMessageParam]);

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
    [addToast, mailbox, router, selectedUid]
  );

  const handleSummarizeMessage = useCallback(
    async (refresh = false) => {
      if (!detail) {
        return;
      }
      if (aiSummaryLoading) {
        setAiSummaryVisible(true);
        return;
      }
      if (!refresh && aiSummary) {
        setAiSummaryVisible(true);
        return;
      }
      if (!detailHasSummarizableContent) {
        addToast({
          variant: "warning",
          title: "Contenu indisponible pour le résumé.",
        });
        return;
      }

      setAiSummaryVisible(true);
      setAiSummaryError(null);
      if (refresh) {
        setAiSummary(null);
      }
      const requestId = ++aiSummaryRequestIdRef.current;
      setAiSummaryLoading(true);

      try {
        const result = await summarizeMessageWithAiAction({
          mailbox,
          uid: detail.uid,
        });
        if (aiSummaryRequestIdRef.current !== requestId) {
          return;
        }
        setAiSummaryLoading(false);
        if (!result.success || !result.data) {
          const message = result.message ?? "Impossible de générer un résumé.";
          setAiSummaryError(message);
          addToast({
            variant: "error",
            title: "Résumé indisponible.",
            description:
              message !== "Impossible de générer un résumé."
                ? message
                : undefined,
          });
          return;
        }
        setAiSummary(result.data.summary.trim());
      } catch (error) {
        console.error("Erreur réseau lors du résumé IA:", error);
        if (aiSummaryRequestIdRef.current !== requestId) {
          return;
        }
        setAiSummaryLoading(false);
        const message = "Erreur réseau lors de la génération du résumé.";
        setAiSummaryError(message);
        addToast({
          variant: "error",
          title: "Erreur réseau.",
        });
      }
    },
    [
      addToast,
      aiSummary,
      aiSummaryLoading,
      detail,
      detailHasSummarizableContent,
      mailbox,
    ]
  );

  const handleLoadMore = async () => {
    if (hiddenLoadedMessageCount > 0) {
      setVisibleMessageCount((current) =>
        Math.min(displayedMessages.length, current + MAILBOX_RENDER_BATCH_SIZE)
      );
      return;
    }
    if (hasActiveSearch) {
      if (searchLoadingMore || !searchResult?.hasMore) {
        return;
      }
      const nextSearchPage = searchResult.page + 1;
      await loadSearchPage({
        query: committedSearchQuery,
        page: nextSearchPage,
        append: true,
        showToastOnError: true,
      });
      return;
    }
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
      })
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
    if (!result.data) {
      addToast({
        variant: "error",
        title: "Réponse invalide du serveur.",
      });
      return;
    }
    const payload = result.data;
    appendMailboxMessages(mailbox, payload.messages, {
      page: payload.page,
      pageSize: payload.pageSize,
      hasMore: payload.hasMore,
      totalMessages: payload.totalMessages,
      lastSync: Date.now(),
    });
    processAutoMoved(payload.autoMoved);
  };

  const handleRefresh = () => {
    const requestId = ++refreshRequestIdRef.current;
    setRefreshing(true);

    void (async () => {
      const localSyncResult = await safeActionCall(() =>
        triggerMailboxLocalSyncAction({
          mailbox,
        })
      );
      if (requestId !== refreshRequestIdRef.current) {
        return;
      }
      if (localSyncResult && !localSyncResult.success) {
        addToast({
          variant: "error",
          title: localSyncResult.message,
        });
      }
      if (hasActiveSearch) {
        const refreshed = await loadSearchPage({
          query: committedSearchQuery,
          page: 1,
          showToastOnError: true,
        });
        if (requestId !== refreshRequestIdRef.current) {
          return;
        }
        setRefreshing(false);
        if (!refreshed) {
          return;
        }
        addToast({
          variant: "success",
          title: "Résultats actualisés.",
        });
        return;
      }

      const result = await safeActionCall(() =>
        fetchMailboxPageAction({
          mailbox,
          page: 1,
          pageSize: pageSizeFromStore,
        })
      );
      if (requestId !== refreshRequestIdRef.current) {
        return;
      }
      setRefreshing(false);
      if (!result) {
        return;
      }
      if (!result.success) {
        addToast({
          variant: "error",
          title: result.message,
        });
        setListError(result.message);
        return;
      }
      if (!result.data) {
        addToast({
          variant: "error",
          title: "Réponse invalide du serveur.",
        });
        return;
      }
      const payload = result.data;
      replaceMailboxMessages(mailbox, {
        messages: payload.messages,
        page: payload.page,
        pageSize: payload.pageSize,
        hasMore: payload.hasMore,
        totalMessages: payload.totalMessages,
      });
      processAutoMoved(payload.autoMoved);
      setListError(null);
      addToast({
        variant: "success",
        title: "Messages actualisés.",
      });
      if (listRef.current) {
        listRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    })();
  };

  const handleMoveMessage = useCallback(
    async (targetMailbox: Mailbox) => {
      if (!detail) {
        return;
      }
      setMovingTarget(targetMailbox);
      const result = await safeActionCall(() =>
        moveMailboxMessageAction({
          mailbox,
          target: targetMailbox,
          uid: detail.uid,
          subject: detail.subject,
          sender: detail.from ?? undefined,
        })
      );
      setMovingTarget(null);
      if (!result) {
        return;
      }
      if (result.success) {
        removeMailboxMessage(mailbox, detail.uid);
        removeMessageFromSearchResult(detail.uid);
        invalidateMailboxCache(targetMailbox);
        setDetail(null);
        setDetailError(null);
        handleClearSelection();
        addToast({
          variant: "success",
          title: MOVE_SUCCESS_MESSAGES[targetMailbox] ?? "Message déplacé.",
        });
      } else {
        addToast({
          variant: "error",
          title: result.message,
        });
      }
    },
    [
      addToast,
      detail,
      handleClearSelection,
      mailbox,
      removeMessageFromSearchResult,
      safeActionCall,
      setDetailError,
    ]
  );
  const displayedListError = hasActiveSearch ? searchError : listError;
  const searchScopeLabel =
    mailbox === "sent" ? "les messages envoyés" : "les messages reçus";
  const searchSummaryText = !searchEnabled
    ? null
    : normalizedSearchInput.length > 0 &&
        !canSubmitSearch
      ? "Saisissez au moins 2 caractères."
      : hasPendingSearchDraft
        ? "Appuyez sur Entrée ou utilisez Rechercher."
      : hasActiveSearch && searchLoading && !searchResult
        ? `Recherche dans ${searchScopeLabel}...`
        : hasActiveSearch && searchResult
          ? `${searchResult.totalMessages} résultat${
              searchResult.totalMessages > 1 ? "s" : ""
            } pour "${committedSearchQuery}".`
          : "Recherchez par adresse, domaine, objet ou contenu.";
  const displayedEmptyStateMessage =
    hasActiveSearch && committedSearchQuery.length > 0
      ? `Aucun message trouvé pour "${committedSearchQuery}".`
      : emptyStateMessage;
  const showInitialSkeleton =
    hasActiveSearch
      ? searchLoading && !searchResult && !searchError
      : (!storeHydrated || !mailboxState.initialized) &&
        !initialPage &&
        (initialLoading || !hasMessages);
  const localSyncBanner = useMemo(() => {
    if (!localSyncOverview.active || !currentLocalSyncMailbox) {
      return null;
    }

    const progressText =
      typeof currentLocalSyncMailbox.progressPercent === "number"
        ? `${currentLocalSyncMailbox.progressPercent}%`
        : "En attente";
    const lastSuccessfulSyncText = currentLocalSyncMailbox.lastSuccessfulSyncAt
      ? formatDate(currentLocalSyncMailbox.lastSuccessfulSyncAt)
      : "Aucune synchronisation réussie pour le moment";
    const detailText = currentLocalSyncMailbox.readable
      ? currentLocalSyncMailbox.backfillComplete
        ? "Cette boîte est lue depuis la base locale. IMAP reste la source de vérité distante."
        : "Cette boîte est déjà lisible localement, mais le backfill complet continue en arrière-plan."
      : currentLocalSyncMailbox.status === "ERROR"
        ? "Cette boîte reste temporairement en IMAP direct à cause d'une erreur de synchronisation locale."
        : "Cette boîte reste temporairement en IMAP direct pendant que le cache local se prépare.";

    return {
      detailText,
      progressText,
      lastSuccessfulSyncText,
      statusLabel: getLocalSyncStatusLabel(currentLocalSyncMailbox.status),
      statusVariant: getLocalSyncStatusVariant(currentLocalSyncMailbox.status),
    };
  }, [currentLocalSyncMailbox, localSyncOverview.active]);

  const handleDownloadAttachment = useCallback(
    async (attachment: MessageDetail["attachments"][number]) => {
      if (!detail) {
        return;
      }
      const attachmentId = attachment.id;
      const downloadUrl = `/api/messagerie/attachments/${mailbox}/${
        detail.uid
      }/${encodeURIComponent(attachmentId)}`;

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
          current === attachmentId ? null : current
        );
      }
    },
    [addToast, detail, mailbox]
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

      const previewUrl = `/api/messagerie/attachments/${mailbox}/${
        detail.uid
      }/${encodeURIComponent(attachmentId)}?inline=1`;

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
          currentOpen === attachmentId ? null : currentOpen
        );
        addToast({
          variant: "error",
          title: "Échec du chargement de la pièce jointe.",
        });
      }
    },
    [addToast, attachmentPreviews, detail, mailbox, openPreviewId]
  );

  const listPaneHidden = !isDesktopLayout && mobilePane !== "list";
  const detailPaneHidden = !isDesktopLayout && mobilePane !== "detail";
  const mailDetailBodyClassName =
    "mail-detail-body prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:font-semibold prose-a:text-blue-600";
  const mailDetailPreClassName =
    "mail-detail-body whitespace-pre-wrap break-words text-sm";

  const listPaneClassName = clsx(
    "w-full max-w-full min-w-0 overflow-x-hidden rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-all duration-300 ease-out will-change-[transform,opacity] dark:border-zinc-800 dark:bg-zinc-900 sm:p-4 lg:block lg:max-h-[78vh] lg:overflow-y-auto lg:pr-2",
    mobilePane === "list"
      ? "relative z-10 translate-y-0 opacity-100"
      : "absolute inset-0 z-0 -translate-y-2 opacity-0 pointer-events-none",
    "lg:relative lg:z-auto lg:translate-y-0 lg:opacity-100 lg:pointer-events-auto"
  );

  const detailPaneClassName = clsx(
    "flex min-h-[320px] w-full max-w-full min-w-0 flex-col overflow-x-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 ease-out will-change-[transform,opacity] dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 lg:max-h-[78vh] lg:overflow-y-auto",
    mobilePane === "detail"
      ? "relative z-10 translate-y-0 opacity-100"
      : "absolute inset-0 z-0 translate-y-2 opacity-0 pointer-events-none",
    "lg:relative lg:z-auto lg:translate-y-0 lg:opacity-100 lg:pointer-events-auto"
  );

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
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

      {localSyncBanner ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">
                  {getLocalSyncModeLabel(localSyncOverview.mode)}
                </Badge>
                <Badge variant={localSyncBanner.statusVariant}>
                  {localSyncBanner.statusLabel}
                </Badge>
                <Badge variant="neutral">{localSyncBanner.progressText}</Badge>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                {localSyncBanner.detailText}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Dernier succès : {localSyncBanner.lastSuccessfulSyncText}. Le
                bouton « Actualiser » relance la synchronisation locale de cette
                boîte avant de recharger l&apos;affichage.
              </p>
              {currentLocalSyncMailbox?.lastError ? (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  Dernière erreur : {currentLocalSyncMailbox.lastError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Local :{" "}
                {typeof currentLocalSyncMailbox?.localMessageCount === "number"
                  ? currentLocalSyncMailbox.localMessageCount
                  : "?"}
              </span>
              <span>
                Distant :{" "}
                {typeof currentLocalSyncMailbox?.remoteMessageCount === "number"
                  ? currentLocalSyncMailbox.remoteMessageCount
                  : "?"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {searchEnabled && isConfigured ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${mailbox}-search`}
                className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
              >
                Rechercher dans {title.toLowerCase()}
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {searchSummaryText}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id={`${mailbox}-search`}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  spellCheck={false}
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                  }}
                  placeholder="Adresse, domaine, objet, contenu..."
                  className="block h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:bg-zinc-900 dark:focus:ring-blue-500/40"
                />
              </div>

              <div className="flex items-center gap-2 sm:flex-none">
                <Button
                  type="submit"
                  className="w-full justify-center sm:w-auto"
                  disabled={!canSubmitSearch && normalizedSearchInput.length > 0}
                  loading={searchLoading}
                >
                  <Search className="h-4 w-4" />
                  Rechercher
                </Button>
                {(searchInput.length > 0 || committedSearchQuery.length > 0) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-center sm:w-auto"
                    onClick={handleClearSearch}
                  >
                    <X className="h-4 w-4" />
                    Effacer
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {!isConfigured && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
          Configurez vos identifiants IMAP pour afficher cette rubrique.
        </div>
      )}

      {isConfigured && (
        <div className="min-w-0 space-y-4 overflow-x-hidden">
          <div className="lg:hidden">
            <div
              className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-1 text-sm font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              role="group"
              aria-label="Navigation messagerie"
            >
              {MOBILE_PANE_TABS.map(({ key, label, icon: Icon }) => {
                const isActive = mobilePane === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (mobilePane !== key) {
                        setMobilePane(key);
                      }
                    }}
                    aria-pressed={isActive}
                    aria-controls={key === "list" ? listPaneId : detailPaneId}
                    className={clsx(
                      "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      isActive
                        ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-x-hidden lg:grid lg:min-w-0 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)] xl:gap-6">
            <div
              id={listPaneId}
              ref={listRef}
              aria-hidden={listPaneHidden ? true : undefined}
              className={listPaneClassName}
            >
              {displayedListError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-100">
                  {displayedListError}
                </div>
              ) : showInitialSkeleton ? (
                <MailboxSkeleton rows={6} />
              ) : !displayedHasMessages ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  <Mail className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
                  <p>{displayedEmptyStateMessage}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div role="list" className="space-y-2">
                    {visibleMessages.map((message) => (
                      <div key={message.uid} role="listitem">
                        <MailboxMessageRow
                          mailbox={mailbox}
                          message={message}
                          isActive={optimisticSelectedUid === message.uid}
                          isLoadingSelection={
                            detailLoading &&
                            (selectedUid === message.uid ||
                              pendingMessageUid === message.uid)
                          }
                          onSelect={handleSelectMessage}
                          onWarm={warmMessageDetail}
                        />
                      </div>
                    ))}
                  </div>

                  {displayedLoadingMore ? <MailboxSkeleton rows={3} /> : null}

                  {hiddenLoadedMessageCount > 0 ? (
                    <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                      {hiddenLoadedMessageCount} message
                      {hiddenLoadedMessageCount > 1 ? "s" : ""} déjà chargé
                      {hiddenLoadedMessageCount > 1 ? "s" : ""}, masqué
                      {hiddenLoadedMessageCount > 1 ? "s" : ""} pour garder la
                      liste fluide.
                    </p>
                  ) : null}

                  {hiddenLoadedMessageCount > 0 || displayedHasMoreMessages ? (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleLoadMore}
                        loading={displayedLoadingMore}
                      >
                        {hiddenLoadedMessageCount > 0
                          ? `Afficher ${Math.min(
                              hiddenLoadedMessageCount,
                              MAILBOX_RENDER_BATCH_SIZE
                            )} de plus`
                          : "Charger plus"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div
              id={detailPaneId}
              ref={detailPaneRef}
              aria-hidden={detailPaneHidden ? true : undefined}
              aria-busy={detailLoading ? true : undefined}
              aria-live="polite"
              className={detailPaneClassName}
            >
              {detailLoading ? (
                <div className="flex flex-1 flex-col justify-start">
                  <MessageDetailSkeleton />
                </div>
              ) : detailError ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {detailError}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={handleClearSelection}
                  >
                    Retour à la liste
                  </Button>
                </div>
              ) : detail ? (
                <div className="space-y-4 min-w-0 max-w-full">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 lg:hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-0 rounded-full px-3 py-1 text-sm"
                        onClick={() => setMobilePane("list")}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Boîte
                      </Button>
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {title}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1">
                        <h3 className="break-words text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                          {detail.subject}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {mailbox === "sent"
                            ? `Envoyé le ${formatDate(detail.date)}`
                            : `Reçu le ${formatDate(detail.date)}`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-center sm:w-auto"
                          onClick={() => handleOpenComposer("reply")}
                        >
                          <Reply className="h-4 w-4" />
                          Répondre
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-center sm:w-auto"
                          onClick={() => handleOpenComposer("reply_all")}
                        >
                          <ReplyAll className="h-4 w-4" />
                          Répondre à tous
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full justify-center sm:w-auto"
                          onClick={() => handleOpenComposer("forward")}
                        >
                          <Forward className="h-4 w-4" />
                          Transférer
                        </Button>
                      </div>
                    </div>
                  </div>
                  {moveOptions.length ? (
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                      {moveOptions.map(
                        ({ target, label, variant, icon: Icon, className }) => {
                          const IconComponent = Icon ?? FolderSymlink;
                          const isLoading = movingTarget === target;
                          return (
                            <Button
                              key={target}
                              type="button"
                              variant={variant}
                              onClick={() => void handleMoveMessage(target)}
                              loading={isLoading}
                              disabled={
                                movingTarget !== null && movingTarget !== target
                              }
                              className={clsx(
                                "w-full justify-center px-3 py-1 text-xs sm:w-auto",
                                className
                              )}
                            >
                              <IconComponent className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium uppercase tracking-wide">
                                {label}
                              </span>
                            </Button>
                          );
                        }
                      )}
                    </div>
                  ) : null}
                  <div className="space-y-2 break-words text-sm text-zinc-700 dark:text-zinc-300">
                    <p>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {mailbox === "sent" ? "À :" : "De :"}
                      </span>{" "}
                      {mailbox === "sent" ? (
                        detail.toAddresses.length > 0 ||
                        detail.to.length > 0 ? (
                          (detail.toAddresses.length > 0
                            ? detail.toAddresses
                            : detail.to.map((raw) => ({
                                name: raw,
                                address: raw,
                              }))
                          ).map((recipient, index) => {
                            const name = (
                              recipient as { name?: string }
                            ).name?.trim();
                            const address = (
                              recipient as {
                                address?: string;
                              }
                            ).address?.trim();
                            const label =
                              name && name.length > 0
                                ? `${name} ${address ?? ""}`.trim()
                                : address ?? name ?? "";
                            const key = `${label}-${index}`;
                            return (
                              <span key={key}>
                                {label}
                                {index <
                                (detail.toAddresses.length > 0
                                  ? detail.toAddresses.length
                                  : detail.to.length) -
                                  1
                                  ? ", "
                                  : ""}
                              </span>
                            );
                          })
                        ) : (
                          "Destinataires inconnus"
                        )
                      ) : detail.fromAddress?.address ? (
                        <button
                          type="button"
                          onClick={() => {
                            const address = detail.fromAddress?.address?.trim();
                            if (!address) {
                              addToast({
                                variant: "warning",
                                title:
                                  "Adresse de l'expéditeur introuvable pour répondre.",
                              });
                              return;
                            }
                            const name = detail.fromAddress?.name?.trim();
                            const recipient =
                              name && name.length > 0
                                ? `${name} <${address}>`
                                : address;
                            const params = new URLSearchParams();
                            params.set("to", recipient);
                            router.push(
                              `/messagerie/nouveau-message?${params.toString()}`
                            );
                          }}
                          className="inline-flex flex-wrap items-center gap-2 rounded-md py-0.5 text-blue-600 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400"
                        >
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                            {detail.fromAddress.name?.trim() ||
                              detail.from?.trim() ||
                              detail.fromAddress.address}
                          </span>
                          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                            {detail.fromAddress.address}
                          </span>
                        </button>
                      ) : detail.from ? (
                        <span>{detail.from}</span>
                      ) : (
                        <span>Expéditeur inconnu</span>
                      )}
                    </p>
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

                  {mailbox === "sent" ? (
                    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            Suivi des interactions
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {detail.tracking
                              ? detail.tracking.trackingEnabled
                                ? "Statistiques consolidées par destinataire."
                                : "Le suivi était désactivé lors de l'envoi."
                              : "Aucune donnée de suivi n'est disponible pour ce message."}
                          </p>
                        </div>
                        {detail.tracking && detail.tracking.trackingEnabled ? (
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="info">
                              {formatCount(
                                detail.tracking.totalOpens,
                                "ouverture",
                                "ouvertures"
                              )}
                            </Badge>
                            <Badge variant="info">
                              {formatCount(
                                detail.tracking.totalClicks,
                                "clic",
                                "clics"
                              )}
                            </Badge>
                          </div>
                        ) : null}
                      </div>
                      {detail.tracking && detail.tracking.trackingEnabled ? (
                        <div className="space-y-3">
                          {detail.tracking.recipients.length ? (
                            <ul className="space-y-2">
                              {detail.tracking.recipients.map((recipient) => {
                                const lastDevice = recipient.devices[0] ?? null;
                                const label =
                                  recipient.name && recipient.name.length > 0
                                    ? `${recipient.name} <${recipient.address}>`
                                    : recipient.address;
                                return (
                                  <li
                                    key={recipient.id}
                                    className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="font-medium text-zinc-800 dark:text-zinc-100">
                                          {label}
                                        </p>
                                        <p className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                          {recipient.type === "TO"
                                            ? "Destinataire principal"
                                            : recipient.type === "CC"
                                            ? "Copie (Cc)"
                                            : "Copie cachée (Bcc)"}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Badge variant="info">
                                          {formatCount(
                                            recipient.openCount,
                                            "ouverture",
                                            "ouvertures"
                                          )}
                                        </Badge>
                                        <Badge variant="info">
                                          {formatCount(
                                            recipient.clickCount,
                                            "clic",
                                            "clics"
                                          )}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="grid gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 sm:grid-cols-3">
                                      <div>
                                        <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                                          Dernière ouverture
                                        </span>
                                        <div>
                                          {recipient.lastOpenedAt
                                            ? formatDate(recipient.lastOpenedAt)
                                            : "Aucune"}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                                          Dernier clic
                                        </span>
                                        <div>
                                          {recipient.lastClickedAt
                                            ? formatDate(
                                                recipient.lastClickedAt
                                              )
                                            : "Aucun"}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                                          Appareil récent
                                        </span>
                                        <div>
                                          {lastDevice
                                            ? `${
                                                lastDevice.deviceFamily ??
                                                "Inconnu"
                                              }${
                                                lastDevice.deviceType
                                                  ? ` · ${lastDevice.deviceType}`
                                                  : ""
                                              }`
                                            : "Non détecté"}
                                        </div>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              Aucun destinataire enregistré pour le suivi.
                            </p>
                          )}
                          {detail.tracking.links.length ? (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                Liens traqués
                              </h4>
                              <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                                {detail.tracking.links.map((link) => (
                                  <li
                                    key={link.id}
                                    className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/80"
                                  >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                      <span className="truncate font-medium text-blue-600 dark:text-blue-300">
                                        {link.url}
                                      </span>
                                      <Badge variant="info">
                                        {formatCount(
                                          link.totalClicks,
                                          "clic",
                                          "clics"
                                        )}
                                      </Badge>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {detailHasSummarizableContent ? (
                    <div className="border-t border-dashed border-zinc-200 pt-4 dark:border-zinc-700">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                        <div>
                          <button
                            type="button"
                            onClick={() => void handleSummarizeMessage()}
                            disabled={aiSummaryLoading}
                            title="Résumer avec l&rsquo;IA"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-blue-300 dark:focus-visible:ring-blue-400"
                          >
                            {aiSummaryLoading ? (
                              <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Sparkles
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            <span className="sr-only">
                              Résumer avec l&rsquo;IA
                            </span>
                          </button>
                        </div>
                        {aiSummaryVisible ? (
                          <div className="flex-1 rounded-lg border border-blue-200/80 bg-blue-50/70 p-4 text-sm text-blue-900 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">
                                  Résumé IA
                                </p>
                                <p className="text-[11px] text-blue-700/80 dark:text-blue-100/80">
                                  Synthèse générée pour ce message
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleSummarizeMessage(true)
                                  }
                                  disabled={aiSummaryLoading}
                                  className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-100 dark:hover:bg-blue-500/20 dark:focus-visible:ring-blue-300"
                                >
                                  <RefreshCw
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  Rafraîchir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAiSummaryVisible(false)}
                                  className="rounded-full border border-transparent p-1 text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:text-blue-100 dark:hover:bg-blue-500/20 dark:focus-visible:ring-blue-300"
                                >
                                  <X className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">
                                    Masquer le résumé
                                  </span>
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 text-sm leading-relaxed text-blue-900 dark:text-blue-100">
                              {aiSummaryLoading ? (
                                <div className="flex items-center gap-2 text-blue-800/80 dark:text-blue-100">
                                  <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                  />
                                  <span>Résumé en cours de génération…</span>
                                </div>
                              ) : aiSummaryError ? (
                                <p className="text-red-600 dark:text-red-300">
                                  {aiSummaryError}
                                </p>
                              ) : aiSummary ? (
                                <p>{aiSummary}</p>
                              ) : (
                                <p className="text-blue-800/80 dark:text-blue-100/80">
                                  Résumé indisponible.
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="w-full max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 sm:p-6">
                    {detail.html ? (
                      <div
                        ref={mailDetailBodyRef}
                        className={mailDetailBodyClassName}
                        dangerouslySetInnerHTML={{
                          __html: detail.html,
                        }}
                      />
                    ) : detail.text ? (
                      <pre className={mailDetailPreClassName}>
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
                        {detail.attachments.map((attachment, index) => {
                          const previewEntry =
                            attachmentPreviews[attachment.id];
                          const effectiveContentType = (
                            previewEntry?.contentType ??
                            attachment.contentType ??
                            ""
                          ).toLowerCase();
                          const canPreview =
                            effectiveContentType.startsWith("image/") ||
                            effectiveContentType === "application/pdf";
                          const displayContentType =
                            attachment.contentType ||
                            "application/octet-stream";
                          const isPreviewReady =
                            openPreviewId === attachment.id &&
                            previewEntry?.status === "ready" &&
                            previewEntry.url;

                          return (
                            <li
                              key={
                                attachment.id
                                  ? `${attachment.id}-${index}`
                                  : `${attachment.filename}-${index}`
                              }
                              className="space-y-3 rounded-md border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <Paperclip className="h-4 w-4 flex-shrink-0 text-zinc-400" />
                                  <div className="min-w-0">
                                    <p className="break-words font-medium text-zinc-800 dark:text-zinc-200">
                                      {attachment.filename}
                                    </p>
                                    <p className="text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                      {displayContentType} ·{" "}
                                      {formatFileSize(attachment.size)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {canPreview ? (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      className="w-full justify-center px-2 py-1 text-xs sm:w-auto"
                                      onClick={() =>
                                        void handlePreviewAttachment(attachment)
                                      }
                                      loading={
                                        previewEntry?.status === "loading"
                                      }
                                    >
                                      {openPreviewId === attachment.id ? (
                                        <>
                                          <EyeOff
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                          />
                                          <span className="sr-only">
                                            Masquer la prévisualisation
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Eye
                                            className="h-4 w-4"
                                            aria-hidden="true"
                                          />
                                          <span className="sr-only">
                                            Prévisualiser la pièce jointe
                                          </span>
                                        </>
                                      )}
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full justify-center px-2 py-1 text-xs sm:w-auto"
                                    onClick={() =>
                                      void handleDownloadAttachment(attachment)
                                    }
                                    loading={
                                      downloadingAttachmentId === attachment.id
                                    }
                                  >
                                    <Download
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                      Télécharger la pièce jointe
                                    </span>
                                  </Button>
                                </div>
                                {previewEntry?.status === "error" ? (
                                  <p
                                    className="w-full text-[11px] text-red-600 dark:text-red-400"
                                    role="alert"
                                  >
                                    Impossible de charger la prévisualisation.
                                    Téléchargez la pièce jointe pour la
                                    consulter.
                                  </p>
                                ) : null}
                              </div>
                              {isPreviewReady ? (
                                <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
                                  {effectiveContentType.startsWith("image/") ? (
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
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  <p>Sélectionnez un message pour afficher son contenu.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full lg:hidden"
                    onClick={() => setMobilePane("list")}
                  >
                    Retour à la liste
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
