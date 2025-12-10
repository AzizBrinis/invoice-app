"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle,
  ArrowDown,
  Bot,
  Loader2,
  Lightbulb,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AssistantActionCard,
  AssistantContextSummary,
  AssistantMessage,
  AssistantPendingConfirmation,
  AssistantSuggestion,
  AssistantUsageSummary,
  AssistantStreamEvent,
} from "@/types/assistant";

const toRoute = (path: string): Route => path as Route;

export type AssistantClientSnapshot = {
  conversationId: string;
  messages: AssistantMessage[];
  usage: AssistantUsageSummary;
  input: string;
  pendingConfirmation: AssistantPendingConfirmation | null;
  streamingText: string;
  awaitingAssistant: boolean;
  actionCards: AssistantActionCard[];
  suggestions: AssistantSuggestion[];
  hasMore: boolean;
  historyCursor: string | null;
  uiError: string | null;
  lastFailedPrompt: string | null;
};

type AssistantClientProps = {
  initialConversationId: string;
  initialMessages: AssistantMessage[];
  initialHasMore: boolean;
  initialCursor: string | null;
  usage: AssistantUsageSummary;
  context: AssistantContextSummary | null;
  variant?: "page" | "panel";
  persistedState?: AssistantClientSnapshot | null;
  initialPendingConfirmation?: AssistantPendingConfirmation | null;
  onSnapshotChange?: (snapshot: AssistantClientSnapshot) => void;
};

type EventHandler = (event: AssistantStreamEvent) => void;

const DEFAULT_QUICK_ACTIONS: AssistantSuggestion[] = [
  {
    id: "quick-invoice",
    label: "Créer une facture",
    prompt:
      "Peux-tu préparer une nouvelle facture pour mon dernier devis accepté ?",
  },
  {
    id: "quick-summary",
    label: "Résumer mes emails",
    prompt:
      "Fais-moi un résumé rapide des derniers emails importants que j’ai reçus.",
  },
  {
    id: "quick-quote",
    label: "Créer un devis",
    prompt:
      "J’ai besoin d’un devis détaillé pour un site vitrine freelance. Peux-tu t’en charger ?",
  },
];

function useEventStream(handler: EventHandler) {
  return async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/assistant", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.body) {
      throw new Error("Flux indisponible.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (!part.startsWith("data:")) continue;
        const payload = part.slice(5).trim();
        if (!payload || payload === "[DONE]") {
          continue;
        }
        try {
          handler(JSON.parse(payload) as AssistantStreamEvent);
        } catch (error) {
          console.warn("Event parse error", error);
        }
      }
    }
  };
}

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatTimestamp(value: string) {
  try {
    return timeFormatter.format(new Date(value));
  } catch {
    return "";
  }
}

type TextSegment =
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

const INLINE_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeLinkHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  const allowed =
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    trimmed.startsWith("/");
  return allowed ? trimmed : null;
}

function formatInlineBase(text: string): string {
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(
    /(^|[^*\\])\*(?!\*)([^*]+?)\*(?!\*)/g,
    (_match, prefix: string, value: string) => `${prefix}<em>${value}</em>`
  );
  formatted = formatted.replace(
    /(^|[^_\\])_([^_]+?)_(?!_)/g,
    (_match, prefix: string, value: string) => `${prefix}<em>${value}</em>`
  );
  return formatted;
}

function formatInline(text: string | null | undefined): string {
  const normalized = typeof text === "string" ? text : "";
  let cursor = 0;
  let html = "";
  const linkRegex = new RegExp(INLINE_LINK_REGEX);
  let match: RegExpExecArray | null = linkRegex.exec(normalized);
  while (match !== null) {
    const [full, label, href] = match;
    const matchIndex = match.index ?? 0;
    html += formatInlineBase(normalized.slice(cursor, matchIndex));
    const safeHref = sanitizeLinkHref(href);
    const safeLabel = formatInlineBase(label);
    if (safeHref) {
      html += `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
    } else {
      html += safeLabel;
    }
    cursor = matchIndex + full.length;
    match = linkRegex.exec(normalized);
  }
  html += formatInlineBase(normalized.slice(cursor));
  return html;
}

function parseTextSegments(text: string | null | undefined): TextSegment[] {
  const normalized = typeof text === "string" ? text : "";
  const lines = normalized.split(/\r?\n/);
  const segments: TextSegment[] = [];
  let paragraph: string[] = [];
  let list: { type: "list"; ordered: boolean; items: string[] } | null =
    null;

  const pushParagraph = () => {
    const content = paragraph.join(" ").trim();
    if (content) {
      segments.push({ type: "paragraph", text: content });
    }
    paragraph = [];
  };

  const pushList = () => {
    if (list && list.items.length) {
      segments.push(list);
    }
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const unordered = line.match(/^[-*•]\s+(.*)$/);
    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/);

    if (heading) {
      if (paragraph.length) {
        pushParagraph();
      }
      if (list) {
        pushList();
      }
      const headingText = heading[1].trim();
      if (headingText) {
        segments.push({ type: "paragraph", text: `**${headingText}**` });
      }
      continue;
    }

    if (unordered) {
      if (paragraph.length) {
        pushParagraph();
      }
      if (!list || list.ordered) {
        pushList();
        list = { type: "list", ordered: false, items: [] };
      }
      const item = unordered[1].trim();
      if (item) {
        list.items.push(item);
      }
      continue;
    }

    if (ordered) {
      if (paragraph.length) {
        pushParagraph();
      }
      if (!list || !list.ordered) {
        pushList();
        list = { type: "list", ordered: true, items: [] };
      }
      const item = ordered[2].trim();
      if (item) {
        list.items.push(item);
      }
      continue;
    }

    if (!line) {
      pushParagraph();
      pushList();
      continue;
    }

    if (list) {
      pushList();
    }
    paragraph.push(line);
  }

  pushParagraph();
  pushList();

  if (!segments.length && normalized.trim()) {
    segments.push({ type: "paragraph", text: normalized.trim() });
  }

  return segments;
}

function renderAssistantMarkup(text: string | null | undefined): string {
  const segments = parseTextSegments(text);
  return segments
    .map((segment) => {
      if (segment.type === "list") {
        const items = segment.items
          .map((item) => `<li>${formatInline(item)}</li>`)
          .join("");
        return segment.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      }
      return `<p>${formatInline(segment.text)}</p>`;
    })
    .join("");
}

function FormattedTextBlock({ text }: { text: string }) {
  const html = useMemo(() => renderAssistantMarkup(text), [text]);
  return (
    <div
      className="formatted-assistant-text space-y-2 break-words leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:pl-1 [&_code]:rounded [&_code]:bg-blue-100/70 [&_code]:px-1.5 [&_code]:py-[2px] [&_code]:font-mono [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 dark:[&_code]:bg-zinc-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const isUser = message.role === "user";
  const label =
    message.role === "assistant"
      ? "Assistant"
      : message.role === "tool"
      ? "Automatisation"
      : isUser
      ? "Vous"
      : "Assistant";
  return (
    <div
      className={clsx(
        "flex w-full gap-3 motion-safe:animate-chat-in",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser ? (
        <div className="hidden sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-zinc-900 to-zinc-700 text-white shadow-lg dark:from-zinc-100 dark:to-zinc-300 dark:text-zinc-900">
            <Bot aria-hidden="true" className="h-4 w-4" />
          </div>
        </div>
      ) : null}
      <div
        className={clsx(
          "flex min-w-0 max-w-full flex-col gap-2 text-sm sm:max-w-[75%] lg:max-w-[65%]",
          isUser ? "items-end text-left" : "items-start text-left"
        )}
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          <span>{label}</span>
          <span className="h-1 w-1 rounded-full bg-zinc-400" />
          <time>{formatTimestamp(message.createdAt)}</time>
        </div>
        <div
          className={clsx(
            "space-y-3 rounded-2xl px-4 py-3 text-base leading-relaxed text-left shadow-sm ring-1 ring-black/5 dark:ring-white/5",
            isUser
              ? "bg-gradient-to-br from-blue-600 to-blue-500 text-white"
              : "bg-white/90 text-zinc-900 backdrop-blur dark:bg-zinc-900/80 dark:text-zinc-50"
          )}
        >
          {message.content.map((block, index) => {
            if (block.type === "text") {
              return (
                <FormattedTextBlock
                  key={`${message.id}-${index}`}
                  text={block.text}
                />
              );
            }
            if (block.type === "action-card") {
              return (
                <ActionCard key={`${message.id}-${index}`} card={block.card} />
              );
            }
            if (block.type === "error") {
              return (
                <p
                  key={`${message.id}-${index}`}
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {block.text}
                </p>
              );
            }
            return null;
          })}
        </div>
      </div>
      {isUser ? (
        <div className="hidden sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <UserRound aria-hidden="true" className="h-4 w-4" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionCard({
  card,
  dense = false,
}: {
  card: AssistantActionCard;
  dense?: boolean;
}) {
  return (
    <div
      className={clsx(
        "w-full min-w-0 rounded-2xl border border-blue-200/60 bg-blue-50/60 text-blue-900 shadow-sm break-words dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100",
        dense ? "space-y-2.5 p-2.5 text-[13px] leading-snug" : "space-y-3 p-3 text-sm"
      )}
    >
      <div className={clsx("space-y-1", dense && "space-y-0.5")}>
        <p className={clsx("font-semibold break-words", dense && "text-[13px] leading-snug")}>
          {card.title}
        </p>
        {card.subtitle ? (
          <p
            className={clsx(
              "text-blue-800 dark:text-blue-200 break-words",
              dense ? "text-[13px] leading-snug" : "text-sm"
            )}
          >
            {card.subtitle}
          </p>
        ) : null}
      </div>
      {card.metadata ? (
        <ul
          className={clsx(
            "w-full min-w-0 space-y-1",
            dense ? "text-xs" : "text-sm"
          )}
        >
          {card.metadata.map((meta) => (
            <li
              key={meta.label}
              className="flex w-full min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <span
                className={clsx(
                  "text-blue-700 dark:text-blue-100",
                  dense && "text-[13px]"
                )}
              >
                {meta.label}
              </span>
              <span
                className={clsx(
                  "w-full font-medium text-blue-900 dark:text-blue-50 sm:w-auto sm:min-w-0 sm:text-right break-words",
                  dense && "text-[13px]"
                )}
              >
                {meta.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {card.actions?.length ? (
        <div className="flex w-full flex-wrap gap-2">
          {card.actions.map((action) =>
            action.href ? (
              <Link
                key={action.label}
                href={toRoute(action.href)}
                className="flex max-w-full items-center rounded-lg border border-blue-200/60 bg-white/90 px-3 py-1 text-left text-xs font-medium text-blue-700 transition whitespace-normal break-words hover:bg-blue-50 dark:bg-zinc-900/80 dark:text-blue-200"
              >
                {action.label}
              </Link>
            ) : (
              <span
                key={action.label}
                className="flex max-w-full items-center rounded-lg border border-blue-200/60 bg-white/90 px-3 py-1 text-left text-xs font-medium text-blue-700 whitespace-normal break-words dark:bg-zinc-900/80 dark:text-blue-200"
              >
                {action.label}
              </span>
            )
          )}
        </div>
      ) : null}
      {card.cta ? (
        <Link
          href={toRoute(card.cta.href)}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {card.cta.label}
          <ArrowDown aria-hidden="true" className="h-3 w-3 rotate-[-90deg]" />
        </Link>
      ) : null}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-2 w-2 rounded-full bg-blue-500/70 animate-bounce"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}

function AssistantResponseSkeleton() {
  return (
    <div className="flex w-full flex-wrap items-start gap-3">
      <div className="hidden sm:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-zinc-900 to-zinc-700 text-white shadow-lg dark:from-zinc-100 dark:to-zinc-300 dark:text-zinc-900">
          <Bot aria-hidden="true" className="h-4 w-4" />
        </div>
      </div>
      <div className="w-full min-w-0 max-w-full rounded-2xl bg-white/90 px-4 py-3 text-base leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/80 dark:text-zinc-50 sm:max-w-[75%]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            <span>Assistant</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span className="text-[10px] font-semibold text-blue-500">
              Rédaction en cours…
            </span>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-4/6" />
            <Skeleton className="h-3.5 w-3/6" />
          </div>
          <div className="text-blue-500/80">
            <TypingDots />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssistantClient({
  initialConversationId,
  initialMessages,
  initialHasMore,
  initialCursor,
  usage: initialUsage,
  context,
  variant = "page",
  persistedState = null,
  initialPendingConfirmation = null,
  onSnapshotChange,
}: AssistantClientProps) {
  const restoredState =
    persistedState && persistedState.conversationId === initialConversationId
      ? persistedState
      : null;
  const [conversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<AssistantMessage[]>(
    restoredState?.messages ?? initialMessages
  );
  const [usage, setUsage] = useState(restoredState?.usage ?? initialUsage);
  const [input, setInput] = useState(restoredState?.input ?? "");
  const [pendingConfirmation, setPendingConfirmation] =
    useState<AssistantPendingConfirmation | null>(
      restoredState?.pendingConfirmation ??
        initialPendingConfirmation ??
        null
    );
  const [streamingText, setStreamingText] = useState(
    restoredState?.streamingText ?? ""
  );
  const [awaitingAssistant, setAwaitingAssistant] = useState(
    restoredState?.awaitingAssistant ?? false
  );
  const [actionCards, setActionCards] = useState<AssistantActionCard[]>(
    restoredState?.actionCards ?? []
  );
  const [busy, setBusy] = useState(false);
  const [uiError, setUiError] = useState<string | null>(
    restoredState?.uiError ?? null
  );
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(
    restoredState?.lastFailedPrompt ?? null
  );
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>(
    restoredState?.suggestions ?? []
  );
  const [hasMore, setHasMore] = useState(
    restoredState?.hasMore ?? initialHasMore
  );
  const [historyCursor, setHistoryCursor] = useState(
    restoredState?.historyCursor ?? initialCursor
  );
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [panelSuggestionsCollapsed, setPanelSuggestionsCollapsed] =
    useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [input]);

  const clientTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const send = useEventStream((event) => {
    if (event.type === "usage" && event.usage) {
      setUsage(event.usage);
      return;
    }
    if (event.type === "message_token") {
      setStreamingText((prev) => `${prev}${event.delta}`);
      setAwaitingAssistant(true);
      return;
    }
    if (event.type === "message_complete") {
      setMessages((prev) => [...prev, event.message]);
      setStreamingText("");
      setAwaitingAssistant(false);
      return;
    }
    if (event.type === "confirmation_required") {
      setPendingConfirmation(event.confirmation);
      setBusy(false);
      setAwaitingAssistant(false);
      return;
    }
    if (event.type === "action_card") {
      setActionCards((prev) => [event.card, ...prev].slice(0, 4));
      return;
    }
    if (event.type === "suggestions") {
      setSuggestions(event.suggestions);
      return;
    }
    if (event.type === "error") {
      setUiError(event.message);
      setBusy(false);
      setAwaitingAssistant(false);
    }
  });

  const sendWithTimezone = useCallback(
    (payload: Record<string, unknown>) =>
      send({
        ...payload,
        clientTimezone,
      }),
    [clientTimezone, send]
  );

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || !historyCursor) {
      return;
    }
    const container = scrollRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    setLoadingOlder(true);
    setHistoryError(null);
    try {
      const params = new URLSearchParams({
        conversationId,
        cursor: historyCursor,
      });
      const response = await fetch(
        `/api/assistant/messages?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Impossible de charger les messages précédents.");
      }
      const data = (await response.json()) as {
        messages: AssistantMessage[];
        hasMore: boolean;
        cursor: string | null;
      };
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMore(data.hasMore);
      setHistoryCursor(data.cursor);
      requestAnimationFrame(() => {
        if (container) {
          const delta = container.scrollHeight - prevScrollHeight;
          container.scrollTop = prevScrollTop + delta;
        }
      });
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Impossible de charger les messages précédents."
      );
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, historyCursor, loadingOlder]);

  useEffect(() => {
    const observerTarget = topSentinelRef.current;
    const container = scrollRef.current;
    if (!observerTarget || !container) {
      return;
    }
    if (!hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadOlderMessages();
        }
      },
      {
        root: container,
        threshold: 0.1,
      }
    );
    observer.observe(observerTarget);
    return () => observer.disconnect();
  }, [hasMore, loadOlderMessages]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      const nearBottom = scrollHeight - (scrollTop + clientHeight) < 120;
      autoScrollRef.current = nearBottom;
      setShowScrollButton(!nearBottom);
    };
    handleScroll();
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (!autoScrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingText]);

  const quickActions = useMemo<AssistantSuggestion[]>(() => {
    if (context?.quickPrompts?.length) {
      return context.quickPrompts;
    }
    if (suggestions.length) {
      return suggestions;
    }
    return DEFAULT_QUICK_ACTIONS;
  }, [context?.quickPrompts, suggestions]);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busy) {
        return;
      }
      const nextMessage: AssistantMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: [{ type: "text", text: trimmed }],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, nextMessage]);
      setInput("");
      setBusy(true);
      setAwaitingAssistant(true);
      setUiError(null);
      setLastFailedPrompt(null);
      autoScrollRef.current = true;
      try {
        await sendWithTimezone({
          conversationId,
          message: trimmed,
        });
      } catch (error) {
        setUiError(
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer votre message."
        );
        setLastFailedPrompt(trimmed);
        setMessages((prev) =>
          prev.filter((message) => message.id !== nextMessage.id)
        );
        setInput(trimmed);
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, sendWithTimezone]
  );

  const handleSend = useCallback(() => {
    void sendPrompt(input);
  }, [input, sendPrompt]);

  const handleRetrySend = useCallback(() => {
    if (lastFailedPrompt) {
      void sendPrompt(lastFailedPrompt);
    }
  }, [lastFailedPrompt, sendPrompt]);

  const handleConfirmTool = useCallback(async () => {
    if (!pendingConfirmation) {
      return;
    }
    const currentConfirmation = pendingConfirmation;
    setPendingConfirmation(null);
    setBusy(true);
    setAwaitingAssistant(true);
    try {
      await sendWithTimezone({
        conversationId,
        confirmToolCallId: currentConfirmation.id,
      });
    } catch (error) {
      setPendingConfirmation(currentConfirmation);
      setUiError(
        error instanceof Error
          ? error.message
          : "Confirmation impossible, veuillez réessayer."
      );
    } finally {
      setBusy(false);
    }
  }, [conversationId, pendingConfirmation, sendWithTimezone]);

  const showTypingIndicator = awaitingAssistant && !streamingText;
  const contentWidthClass = "mx-auto w-full max-w-4xl";

  const renderMessages = useMemo(() => {
    if (!messages.length && !streamingText) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500 dark:text-zinc-400">
          <Sparkles
            aria-hidden="true"
            className="mb-3 h-10 w-10 text-blue-500"
          />
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
            Commencez la conversation
          </p>
          <p className="mt-1 max-w-sm text-sm">
            Posez une question ou inspirez-vous des actions rapides ci-dessous
            pour lancer l’assistant.
          </p>
        </div>
      );
    }
    return (
      <div
        className={clsx(
          contentWidthClass,
          "flex w-full min-w-0 flex-col gap-6 px-1 sm:px-2"
        )}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {streamingText ? (
          <div className="flex w-full flex-wrap items-start gap-3">
            <div className="hidden sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-zinc-900 to-zinc-700 text-white shadow-lg dark:from-zinc-100 dark:to-zinc-300 dark:text-zinc-900">
                <Bot aria-hidden="true" className="h-4 w-4" />
              </div>
            </div>
            <div className="w-full min-w-0 max-w-full rounded-2xl bg-white/90 px-4 py-3 text-base leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/80 dark:text-zinc-50 sm:max-w-[75%] break-words">
              <FormattedTextBlock text={streamingText} />
            </div>
          </div>
        ) : null}
        {showTypingIndicator ? <AssistantResponseSkeleton /> : null}
      </div>
    );
  }, [messages, showTypingIndicator, streamingText]);

  const snapshot = useMemo<AssistantClientSnapshot>(
    () => ({
      conversationId,
      messages,
      usage,
      input,
      pendingConfirmation,
      streamingText,
      awaitingAssistant,
      actionCards,
      suggestions,
      hasMore,
      historyCursor,
      uiError,
      lastFailedPrompt,
    }),
    [
      actionCards,
      awaitingAssistant,
      conversationId,
      hasMore,
      historyCursor,
      input,
      lastFailedPrompt,
      messages,
      pendingConfirmation,
      suggestions,
      streamingText,
      uiError,
      usage,
    ]
  );

  useEffect(() => {
    if (!onSnapshotChange) {
      return;
    }
    onSnapshotChange(snapshot);
  }, [onSnapshotChange, snapshot]);

  const isPageVariant = variant === "page";
  const showMetaSection = isPageVariant;
  const showQuickActionsSection = isPageVariant && quickActions.length > 0;

  return (
    <div
      className={clsx(
        "relative flex w-full max-w-full min-w-0 min-h-0 flex-col gap-6 overflow-x-hidden",
        variant === "panel" ? "h-full min-h-0" : "min-h-[calc(100vh-220px)]"
      )}
    >
      <section
        className={clsx(
          "flex w-full max-w-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-white via-blue-50/40 to-white shadow-2xl shadow-blue-500/10 transition dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900 min-h-0",
          variant === "panel" ? "flex-1" : "min-h-[60vh]"
        )}
      >
        {isPageVariant ? (
          <div className="flex w-full min-w-0 flex-col gap-4 border-b border-white/60 px-4 py-4 backdrop-blur dark:border-zinc-800/80 sm:px-6">
            <div className="w-full min-w-0 space-y-2">
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Assistant intelligent
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Posez une question ou laissez-vous guider par ses suggestions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              {busy ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100/70 px-3 py-1 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                  <Loader2
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin"
                  />
                  Assistant en cours
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  Disponible
                </span>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-medium text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200">
                <Bot aria-hidden="true" className="h-3.5 w-3.5" />
                Expérience optimisée et instantanée
              </span>
            </div>
          </div>
        ) : null}
        {showMetaSection ? (
          <div className="flex w-full min-w-0 flex-col gap-3 border-b border-white/60 px-4 py-4 text-sm dark:border-zinc-800/80 sm:px-6">
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/70 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                  Quota assistant
                </span>
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-50">
                  {usage.remaining} restants
                </span>
                <span className="text-[11px] text-blue-600/80 dark:text-blue-200/80">
                  sur {usage.limit} ({usage.periodLabel})
                </span>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    usage.locked
                      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100"
                  )}
                >
                  {usage.locked ? "Limite atteinte" : "Disponible"}
                </span>
              </div>
              {!context ? (
                <div className="inline-flex min-w-0 flex-1 items-start gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-xs text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100">
                  <Lightbulb
                    aria-hidden="true"
                    className="h-4 w-4 flex-none text-amber-500 dark:text-amber-300"
                  />
                  <p className="min-w-0 text-left leading-snug">
                    Ajoutez un contexte (facture, client, email) pour
                    personnaliser les réponses de l’assistant.
                  </p>
                </div>
              ) : null}
            </div>
            {context ? (
              <div className="space-y-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 text-emerald-900 shadow-sm break-words dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Contexte actif
                </p>
                <p className="text-base font-semibold">{context.title}</p>
                {context.subtitle ? (
                  <p className="text-sm opacity-80">{context.subtitle}</p>
                ) : null}
                {context.metadata ? (
                  <ul className="text-xs opacity-70">
                    {context.metadata.map((meta) => (
                      <li key={meta.label} className="break-words">
                        {meta.label}: <strong>{meta.value}</strong>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex w-full flex-1 min-h-0 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            className="relative w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-5 scroll-smooth sm:px-4 sm:py-6 lg:px-6"
          >
            <div
              className={clsx(contentWidthClass, "flex flex-col gap-4 min-w-0")}
            >
              <div ref={topSentinelRef} />
              {loadingOlder ? (
                <div className="mb-4 flex items-center justify-center text-xs text-zinc-400">
                  <Spinner size="sm" label="Chargement de l’historique" />
                </div>
              ) : null}
              {historyError ? (
                <div className="mb-4 w-full rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 break-words dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  {historyError}{" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => void loadOlderMessages()}
                  >
                    Réessayer
                  </button>
                </div>
              ) : null}
              {renderMessages}
            </div>
            {showScrollButton ? (
              <button
                type="button"
                onClick={() => {
                  if (!scrollRef.current) return;
                  scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }}
                className="group absolute bottom-6 right-6 hidden items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-zinc-500 shadow-lg ring-1 ring-black/5 transition hover:text-blue-600 dark:bg-zinc-900/80 dark:text-zinc-300 lg:flex"
              >
                <ArrowDown
                  aria-hidden="true"
                  className="h-3.5 w-3.5 transition group-hover:translate-y-0.5"
                />
                Revenir en bas
              </button>
            ) : null}
          </div>
          {pendingConfirmation ? (
            <div className="w-full border-t border-zinc-100/60 bg-white/80 px-4 py-4 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-50 sm:px-6">
              <div className={clsx(contentWidthClass, "space-y-3")}>
                <p className="font-semibold">Confirmation requise</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {pendingConfirmation.summary}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() => void handleConfirmTool()}
                    disabled={busy}
                  >
                    Confirmer
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPendingConfirmation(null)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {actionCards.length ? (
            <div
              className={clsx(
                "w-full border-t border-zinc-100/60 bg-white/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/60 sm:px-6",
                variant === "panel" && "py-2.5 sm:px-4"
              )}
            >
              <div
                className={clsx(
                  contentWidthClass,
                  "space-y-3",
                  variant === "panel" && "space-y-2"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={clsx(
                      "font-semibold text-zinc-700 dark:text-zinc-200",
                      variant === "panel"
                        ? "text-xs uppercase tracking-wide"
                        : "text-sm"
                    )}
                  >
                    Suggestions intelligentes
                  </p>
                  {variant === "panel" ? (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                      onClick={() =>
                        setPanelSuggestionsCollapsed((value) => !value)
                      }
                    >
                      {panelSuggestionsCollapsed ? "Afficher" : "Masquer"}
                    </button>
                  ) : null}
                </div>
                {!panelSuggestionsCollapsed ? (
                  <div
                    className={clsx(
                      "grid w-full md:grid-cols-2",
                      variant === "panel"
                        ? "max-h-48 min-w-0 overflow-y-auto gap-2 pr-1 sm:grid-cols-2"
                        : "gap-3"
                    )}
                  >
                    {actionCards.map((card, index) => (
                      <ActionCard
                        card={card}
                        key={`${card.title}-${index}`}
                        dense={variant === "panel"}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="w-full border-t border-zinc-200/70 bg-white/95 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6">
            <div
              className={clsx(contentWidthClass, "flex w-full flex-col gap-2.5")}
            >
              <div className="relative flex w-full flex-1">
                <div className="relative flex flex-1 min-w-0 rounded-2xl bg-white/95 shadow-inner ring-1 ring-zinc-200 transition focus-within:ring-2 focus-within:ring-blue-500 dark:bg-zinc-900/80 dark:ring-zinc-700">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    className="min-h-[48px] max-h-[200px] w-full resize-none bg-transparent py-3 pl-4 pr-16 text-base leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder="Expliquez votre besoin…"
                    value={input}
                    disabled={busy}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Envoyer le message"
                    onClick={handleSend}
                    disabled={busy || !input.trim()}
                    className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 ring-2 ring-white/80 transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-zinc-800"
                  >
                    {busy ? (
                      <Loader2
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin text-current"
                      />
                    ) : (
                      <Send
                        aria-hidden="true"
                        className="h-4 w-4 text-current"
                      />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Entrée pour envoyer · Maj + Entrée pour ajouter une ligne
              </p>
              {uiError ? (
                <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  <span className="flex items-center gap-2">
                    <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                    {uiError}
                  </span>
                  {lastFailedPrompt ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-semibold text-amber-900 shadow dark:bg-zinc-900/60 dark:text-amber-100"
                      onClick={handleRetrySend}
                    >
                      <RefreshCw aria-hidden="true" className="h-3 w-3" />
                      Réessayer
                    </button>
                  ) : null}
                </div>
              ) : null}
              {showQuickActionsSection ? (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Actions rapides
                  </p>
                  <div className="flex w-full flex-wrap gap-1.5">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="inline-flex items-center justify-center whitespace-normal rounded-2xl border border-zinc-200/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
                        onClick={() => setInput(action.prompt)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
