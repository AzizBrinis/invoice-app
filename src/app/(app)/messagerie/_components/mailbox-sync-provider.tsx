"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
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
  updateMailboxMetadata,
  getMailboxStoreSnapshot,
  MAILBOX_KEYS,
  removeMailboxMessage,
  invalidateMailboxCache,
  setMailboxCacheUser,
  beginMailboxSync,
  endMailboxSync,
  isMailboxCacheStale,
} from "@/app/(app)/messagerie/_state/mailbox-store";

const MAILBOXES = MAILBOX_KEYS;
const BACKGROUND_SYNC_INTERVAL = 5 * 60 * 1000;
const BACKGROUND_SYNC_MIN_INTERVAL = 60 * 1000;
const VISIBILITY_SYNC_DELAY = 2000;
const INITIAL_SYNC_DELAY_MS = 200;
const ALWAYS_SYNC_MAILBOXES: Mailbox[] = ["inbox"];
const MAILBOX_PATHNAMES: Record<Mailbox, string> = {
  inbox: "/messagerie/recus",
  sent: "/messagerie/envoyes",
  drafts: "/messagerie/brouillons",
  trash: "/messagerie/corbeille",
  spam: "/messagerie/spam",
};

function getLikelyMailboxTargets(currentMailbox: Mailbox | null) {
  const targets: Mailbox[] = currentMailbox
    ? currentMailbox === "inbox"
      ? ["inbox", "sent", "drafts"]
      : currentMailbox === "sent"
        ? ["sent", "inbox", "drafts"]
        : [currentMailbox, "inbox", "sent"]
    : ["inbox", "sent", "drafts"];
  return Array.from(new Set(targets));
}

function shouldBackgroundSync(
  mailbox: Mailbox,
  currentMailbox: Mailbox | null,
) {
  if (ALWAYS_SYNC_MAILBOXES.includes(mailbox)) {
    return true;
  }
  return currentMailbox === mailbox;
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
  localSyncActive: boolean;
  userId: string;
};

export function MailboxSyncProvider({
  enabled,
  localSyncActive,
  userId,
}: MailboxSyncProviderProps) {
  const syncStatusRef = useRef<Record<Mailbox, boolean>>(createInitialSyncStatus());
  const lastSyncAllAtRef = useRef(0);
  const visibilityTimeoutRef = useRef<number | null>(null);
  const primedUserIdRef = useRef<string | null>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (primedUserIdRef.current === userId) {
      return;
    }
    setMailboxCacheUser(userId);
    syncStatusRef.current = createInitialSyncStatus();
    primedUserIdRef.current = userId;
  }, [userId]);

  useMailboxStore(() => null);
  const { addToast } = useToast();
  const router = useRouter();
  const currentMailbox = pathname?.startsWith("/messagerie/recus")
    ? "inbox"
    : pathname?.startsWith("/messagerie/envoyes")
      ? "sent"
      : pathname?.startsWith("/messagerie/brouillons")
        ? "drafts"
        : pathname?.startsWith("/messagerie/corbeille")
          ? "trash"
          : pathname?.startsWith("/messagerie/spam")
            ? "spam"
            : null;

  const safeActionCall = useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T> | null> => {
      try {
        return await action();
      } catch (error) {
        console.error("Erreur réseau lors de la synchronisation de messagerie:", error);
        return null;
      }
    },
    [],
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
        if (!shouldBackgroundSync(mailbox, currentMailbox)) {
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
        if (payload.requiresSnapshot) {
          await synchronizeSnapshot(mailbox);
          return;
        }
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
          updateMailboxMetadata(mailbox, {
            totalMessages: payload.totalMessages,
            lastSync: Date.now(),
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
    [addToast, currentMailbox, enabled, handleAutoMoved, router, safeActionCall, synchronizeSnapshot],
  );

  useEffect(() => {
    if (!enabled || !localSyncActive) {
      return;
    }

    const targets = getLikelyMailboxTargets(currentMailbox);
    const snapshot = getMailboxStoreSnapshot();

    targets.forEach((mailbox) => {
      try {
        router.prefetch(MAILBOX_PATHNAMES[mailbox] as Route);
      } catch {
        // Ignore route-prefetch failures and keep local snapshot warming.
      }
    });

    targets.forEach((mailbox) => {
      const cached = snapshot.mailboxes[mailbox];
      if (cached.syncing || (cached.initialized && !isMailboxCacheStale(cached))) {
        return;
      }
      void synchronizeSnapshot(mailbox);
    });
  }, [currentMailbox, enabled, localSyncActive, router, synchronizeSnapshot]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let initialSyncTimer: number | null = null;

    const syncAll = (options?: { force?: boolean }) => {
      if (cancelled || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (
        !options?.force &&
        now - lastSyncAllAtRef.current < BACKGROUND_SYNC_MIN_INTERVAL
      ) {
        return;
      }
      lastSyncAllAtRef.current = now;
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
        initialSyncTimer = window.setTimeout(
          () => syncAll({ force: true }),
          INITIAL_SYNC_DELAY_MS,
        );
      } else {
        syncAll({ force: true });
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
    const handleFocus = () => {
      syncAll();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
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
