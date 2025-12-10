"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Loader2, Maximize2, MessageCircle, Minimize2, Sparkles, X } from "lucide-react";
import type { AssistantClientSnapshot } from "@/app/(app)/assistant/assistant-client";
import type {
  AssistantContextSummary,
  AssistantMessage,
  AssistantPendingConfirmation,
  AssistantUsageSummary,
} from "@/types/assistant";
import { Button } from "@/components/ui/button";
import { AssistantSkeleton } from "@/components/skeletons";

const AssistantClient = dynamic(
  () =>
    import("@/app/(app)/assistant/assistant-client").then(
      (module) => module.AssistantClient,
    ),
  {
    ssr: false,
    loading: () => <AssistantSkeleton variant="panel" />,
  },
);

type BootstrapPayload = {
  conversationId: string;
  messages: AssistantMessage[];
  hasMore: boolean;
  cursor: string | null;
  usage: AssistantUsageSummary;
  context: AssistantContextSummary | null;
  pendingConfirmation: AssistantPendingConfirmation | null;
};

type PanelMode = "compact" | "expanded";

const MESSAGING_LAUNCHER_BOTTOM = "calc(env(safe-area-inset-bottom) + 5.5rem)";
const MESSAGING_PANEL_BOTTOM = "calc(env(safe-area-inset-bottom) + 9.5rem)";

let cachedOpen = false;
let cachedPayload: BootstrapPayload | null = null;
let cachedSnapshot: AssistantClientSnapshot | null = null;
let cachedPanelMode: PanelMode = "compact";

export function AssistantLauncher() {
  const pathname = usePathname();
  const isMessagingRoute = pathname?.startsWith("/messagerie");
  const launcherPositionClass = clsx(
    isMessagingRoute
      ? "bottom-[5.5rem] right-4 sm:right-6"
      : "bottom-5 right-4 sm:bottom-6 sm:right-6",
    "md:right-8",
  );
  const launcherInlineStyle: CSSProperties | undefined = isMessagingRoute
    ? { bottom: MESSAGING_LAUNCHER_BOTTOM }
    : undefined;
  const [open, setOpen] = useState(cachedOpen);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BootstrapPayload | null>(cachedPayload);
  const [panelMode, setPanelMode] = useState<PanelMode>(cachedPanelMode);
  const snapshotRef = useRef<AssistantClientSnapshot | null>(cachedSnapshot);

  useEffect(() => {
    cachedOpen = open;
  }, [open]);

  useEffect(() => {
    cachedPayload = payload;
  }, [payload]);

  useEffect(() => {
    cachedPanelMode = panelMode;
  }, [panelMode]);

  const handleSnapshotChange = useCallback((snapshot: AssistantClientSnapshot) => {
    cachedSnapshot = snapshot;
    snapshotRef.current = snapshot;
  }, []);

  const fetchBootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conversationId = snapshotRef.current?.conversationId;
      const query = conversationId
        ? `?conversationId=${encodeURIComponent(conversationId)}`
        : "";
      const response = await fetch(`/api/assistant/bootstrap${query}`);
      if (!response.ok) {
        throw new Error("Assistant indisponible pour le moment.");
      }
      const data = (await response.json()) as BootstrapPayload;
      setPayload(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Assistant indisponible pour le moment.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !payload && !loading && !error) {
      void fetchBootstrap();
    }
  }, [error, fetchBootstrap, loading, open, payload]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (pathname?.startsWith("/assistant") && open) {
      setOpen(false);
    }
  }, [open, pathname]);

  if (pathname?.startsWith("/assistant")) {
    return null;
  }

  const panelOffsetClass = isMessagingRoute
    ? "bottom-[9.5rem]"
    : "bottom-2 sm:bottom-8";
  const panelStyle: CSSProperties | undefined = isMessagingRoute
    ? { bottom: MESSAGING_PANEL_BOTTOM }
    : undefined;
  const panelSizeClasses = clsx(
    "w-full",
    panelMode === "expanded"
      ? "h-[min(90vh,680px)] max-w-md sm:h-[520px] sm:max-w-lg lg:h-[620px] lg:w-[520px]"
      : "h-[min(78vh,560px)] max-w-sm sm:h-[420px] sm:max-w-md lg:h-[500px] lg:w-[400px]",
  );

  return (
    <>
      {open ? (
        <div
          className={clsx(
            "fixed inset-x-3 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end",
            panelOffsetClass,
          )}
          style={panelStyle}
        >
          <div
            className={clsx(
              "flex w-full max-w-full flex-col overflow-hidden rounded-t-3xl border border-zinc-200/80 bg-white/95 shadow-2xl shadow-blue-500/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:rounded-3xl",
              panelSizeClasses,
            )}
            role="dialog"
            aria-label="Assistant AI"
          >
            <div className="px-4 pt-3 sm:px-5">
              <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700 sm:hidden" />
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-3 dark:border-zinc-800">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30">
                    <Sparkles aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Assistant AI
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Continuez à travailler pendant la discussion
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="hidden rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 sm:flex"
                    aria-label={
                      panelMode === "expanded"
                        ? "Réduire la fenêtre"
                        : "Agrandir la fenêtre"
                    }
                    onClick={() =>
                      setPanelMode((mode) =>
                        mode === "compact" ? "expanded" : "compact",
                      )
                    }
                  >
                    {panelMode === "expanded" ? (
                      <Minimize2 aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Maximize2 aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    aria-label="Fermer l’assistant AI"
                    onClick={() => setOpen(false)}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
                <div className="flex w-full flex-1 min-h-0 flex-col">
                {payload ? (
                  <div className="flex h-full w-full flex-1 min-h-0 flex-col px-3 pb-4 pt-2 sm:px-4 sm:pb-5">
                    <AssistantClient
                      initialConversationId={payload.conversationId}
                      initialMessages={payload.messages}
                      initialHasMore={payload.hasMore}
                      initialCursor={payload.cursor}
                      usage={payload.usage}
                      context={payload.context}
                      variant="panel"
                      initialPendingConfirmation={payload.pendingConfirmation}
                      persistedState={snapshotRef.current}
                      onSnapshotChange={handleSnapshotChange}
                    />
                  </div>
                ) : loading ? (
                  <div className="flex h-full w-full flex-1 min-h-0 flex-col px-3 pb-4 pt-2 sm:px-4 sm:pb-5">
                    <AssistantSkeleton variant="panel" />
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      Préparation de l’assistant…
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex h-full w-full flex-1 min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-zinc-500 dark:text-zinc-300">
                    <MessageCircle aria-hidden="true" className="h-8 w-8 text-amber-500" />
                    <p>{error}</p>
                    <Button variant="primary" onClick={() => void fetchBootstrap()}>
                      Réessayer
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-1 min-h-0 flex-col px-3 pb-4 pt-2 sm:px-4 sm:pb-5">
                    <AssistantSkeleton variant="panel" />
                  </div>
                )}
                </div>
              </div>
            </div>
      ) : null}
      <button
        type="button"
        className={clsx(
          "fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/40 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          launcherPositionClass,
          open ? "ring-2 ring-white/70 dark:ring-zinc-800" : undefined,
        )}
        style={launcherInlineStyle}
        aria-label={open ? "Fermer l’assistant AI" : "Ouvrir l’assistant AI"}
        aria-pressed={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Sparkles aria-hidden="true" className="h-5 w-5" />
      </button>
    </>
  );
}
