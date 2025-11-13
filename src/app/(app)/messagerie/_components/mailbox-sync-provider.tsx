"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Mailbox } from "@/server/messaging";
import {
  fetchMailboxPageAction,
  fetchMailboxUpdatesAction,
  type ActionResult,
} from "@/app/(app)/messagerie/actions";
import { useToast } from "@/components/ui/toast-provider";
import {
  useMailboxStore,
  appendMailboxMessages,
  replaceMailboxMessages,
  getMailboxStoreSnapshot,
  MAILBOX_KEYS,
  removeMailboxMessage,
  invalidateMailboxCache,
  setMailboxCacheUser,
  clearMailboxCache,
  beginMailboxSync,
  endMailboxSync,
} from "@/app/(app)/messagerie/_state/mailbox-store";

const MAILBOXES = MAILBOX_KEYS;
const BACKGROUND_SYNC_INTERVAL = 3 * 60 * 1000;
const VISIBILITY_SYNC_DELAY = 2000;
const INITIAL_SYNC_DELAY_MS = 200;
const ALWAYS_SYNC_MAILBOXES: Mailbox[] = ["inbox"];
type MailboxCacheState =
  ReturnType<typeof getMailboxStoreSnapshot>["mailboxes"][Mailbox];

function shouldBackgroundSync(
  mailbox: Mailbox,
  cache: MailboxCacheState | undefined,
) {
  if (ALWAYS_SYNC_MAILBOXES.includes(mailbox)) {
    return true;
  }
  return cache?.active ?? false;
}

function createInitialSyncStatus(): Record<Mailbox, boolean> {
  return MAILBOXES.reduce<Record<Mailbox, boolean>>(
    (acc, mailbox) => {
      acc[mailbox] = false;
      return acc;
    },
    {} as Record<Mailbox, boolean>,
  );
}

export type MailboxSyncProviderProps = {
  enabled: boolean;
  userId: string;
};

export function MailboxSyncProvider({
  enabled,
  userId,
}: MailboxSyncProviderProps) {
  const syncStatusRef = useRef<Record<Mailbox, boolean>>(createInitialSyncStatus());
  const visibilityTimeoutRef = useRef<number | null>(null);
  const primedUserIdRef = useRef<string | null>(null);

  if (primedUserIdRef.current !== userId) {
    const previousUserId = primedUserIdRef.current;
    if (previousUserId && previousUserId !== userId) {
      clearMailboxCache(previousUserId);
    }
    setMailboxCacheUser(userId);
    syncStatusRef.current = createInitialSyncStatus();
    primedUserIdRef.current = userId;
  }

  useMailboxStore(() => null);
  const { addToast } = useToast();
  const router = useRouter();

  const safeActionCall = useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> => {
      try {
        return await action();
      } catch (error) {
        console.error("Erreur réseau lors de la synchronisation de messagerie:", error);
        addToast({
          variant: "error",
          title: "Erreur de synchronisation des messages.",
        });
        return null;
      }
    },
    [addToast],
  );

  const handleAutoMoved = useCallback(
    (mailbox: Mailbox, entries?: Array<{ uid: number; subject: string; from: string | null }>) => {
      if (!entries?.length) {
        return;
      }
      let invalidated = false;
      entries.forEach((entry) => {
        removeMailboxMessage(mailbox, entry.uid);
        addToast({
          variant: "warning",
          title: "Déplacé dans les indésirables",
          description: entry.subject ? `Objet : ${entry.subject}` : undefined,
        });
        if (!invalidated) {
          invalidateMailboxCache("spam");
          invalidated = true;
        }
      });
    },
    [addToast],
  );

  const synchronizeSnapshot = useCallback(
    async (mailbox: Mailbox) => {
      const acquired = beginMailboxSync(mailbox);
      if (!acquired) {
        return;
      }
      try {
        const result = await safeActionCall(() =>
          fetchMailboxPageAction({
            mailbox,
            page: 1,
          }),
        );
        if (!result || !result.success) {
          return;
        }
        if (!result.data) {
          addToast({
            variant: "error",
            title: "Réponse invalide du serveur (snapshot).",
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
        handleAutoMoved(mailbox, payload.autoMoved);
      } finally {
        endMailboxSync(mailbox);
      }
    },
    [addToast, handleAutoMoved, safeActionCall],
  );

  const synchronizeMailbox = useCallback(
    async (mailbox: Mailbox) => {
      if (!enabled || syncStatusRef.current[mailbox]) {
        return;
      }

      syncStatusRef.current[mailbox] = true;
      try {
        const snapshot = getMailboxStoreSnapshot();
        const cached = snapshot.mailboxes[mailbox];
        if (!shouldBackgroundSync(mailbox, cached)) {
          return;
        }
        if (!cached.initialized || !cached.latestUid) {
          await synchronizeSnapshot(mailbox);
          return;
        }
        const result = await safeActionCall(() =>
          fetchMailboxUpdatesAction({
            mailbox,
            sinceUid: cached.latestUid!,
          }),
        );
        if (!result || !result.success) {
          return;
        }
        if (!result.data) {
          addToast({
            variant: "error",
            title: "Réponse invalide du serveur (synchronisation).",
          });
          return;
        }
        const payload = result.data;
        const existingUids = new Set(cached.messages.map((item) => item.uid));
        const newMessages = payload.messages.filter(
          (item) => !existingUids.has(item.uid),
        );
        if (payload.messages.length) {
          appendMailboxMessages(mailbox, payload.messages, {
            totalMessages: payload.totalMessages ?? undefined,
            lastSync: Date.now(),
          });
          handleAutoMoved(mailbox, payload.autoMoved);
          if (mailbox === "inbox" && newMessages.length) {
            newMessages.forEach((message) => {
              addToast({
                variant: "success",
                title: `👉 Nouveau message de ${message.from}`,
                description: `Objet : ${message.subject}`,
                duration: 8000,
                onClick: () => {
                  router.push(`/messagerie/recus?message=${message.uid}`);
                },
              });
            });
          }
        } else if (typeof payload.totalMessages === "number") {
          replaceMailboxMessages(mailbox, {
            messages: cached.messages,
            page: cached.page,
            pageSize: cached.pageSize,
            hasMore: cached.hasMore,
            totalMessages: payload.totalMessages,
          });
          handleAutoMoved(mailbox, payload.autoMoved);
        }
        if (
          typeof payload.totalMessages === "number" &&
          cached.totalMessages !== null &&
          payload.totalMessages < cached.totalMessages
        ) {
          await synchronizeSnapshot(mailbox);
        }
      } finally {
        syncStatusRef.current[mailbox] = false;
      }
    },
    [addToast, enabled, handleAutoMoved, router, safeActionCall, synchronizeSnapshot],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let initialSyncTimer: number | null = null;

    const syncAll = () => {
      if (cancelled) return;
      MAILBOXES.forEach((mailbox) => {
        void synchronizeMailbox(mailbox);
      });
    };

    const scheduleInitialSync = () => {
      if (cancelled) return;
      const snapshot = getMailboxStoreSnapshot();
      const needsHydrationDelay = MAILBOXES.every((mailbox) => {
        const cache = snapshot.mailboxes[mailbox];
        return (
          !cache.initialized &&
          cache.messages.length === 0 &&
          cache.lastSync === null
        );
      });
      if (needsHydrationDelay) {
        initialSyncTimer = window.setTimeout(syncAll, INITIAL_SYNC_DELAY_MS);
      } else {
        syncAll();
      }
    };

    scheduleInitialSync();

    const interval = window.setInterval(syncAll, BACKGROUND_SYNC_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (visibilityTimeoutRef.current) {
          window.clearTimeout(visibilityTimeoutRef.current);
        }
        visibilityTimeoutRef.current = window.setTimeout(() => {
          syncAll();
          visibilityTimeoutRef.current = null;
        }, VISIBILITY_SYNC_DELAY);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", syncAll);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", syncAll);
      if (initialSyncTimer) {
        window.clearTimeout(initialSyncTimer);
      }
      if (visibilityTimeoutRef.current) {
        window.clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [enabled, synchronizeMailbox]);

  return null;
}
