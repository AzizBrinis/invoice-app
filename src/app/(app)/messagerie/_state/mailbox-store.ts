import { useSyncExternalStore } from "react";
import type { Mailbox, MailboxListItem } from "@/server/messaging";

export const MAILBOX_KEYS: Mailbox[] = [
  "inbox",
  "sent",
  "drafts",
  "trash",
  "spam",
];

type MailboxCache = {
  messages: MailboxListItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  initialized: boolean;
  lastSync: number | null;
  latestUid: number | null;
  totalMessages: number | null;
};

type StoreState = {
  mailboxes: Record<Mailbox, MailboxCache>;
};

type MailboxUpdateOptions = {
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  totalMessages?: number | null;
  lastSync?: number;
};

const defaultMailboxCache = (): MailboxCache => ({
  messages: [],
  page: 1,
  pageSize: 20,
  hasMore: false,
  initialized: false,
  lastSync: null,
  latestUid: null,
  totalMessages: null,
});

const STORAGE_KEY = "mailbox-cache-v2";

function createInitialState(): StoreState {
  const entries = MAILBOX_KEYS.reduce<Record<Mailbox, MailboxCache>>(
    (acc, key) => {
      acc[key] = defaultMailboxCache();
      return acc;
    },
    {} as Record<Mailbox, MailboxCache>,
  );
  return { mailboxes: entries };
}

const initialState: StoreState = createInitialState();

type Listener = () => void;

let hasHydratedFromStorage = false;

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function persistState(state: StoreState) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mailboxes: state.mailboxes,
      }),
    );
  } catch (error) {
    console.error("Impossible de persister le cache de messagerie:", error);
  }
}

function hydrateFromStorage() {
  if (hasHydratedFromStorage) {
    return;
  }
  hasHydratedFromStorage = true;
  const storage = getStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    if (!parsed?.mailboxes) return;
    const mailboxes = MAILBOX_KEYS.reduce<Record<Mailbox, MailboxCache>>(
      (acc, key) => {
        acc[key] = {
          ...defaultMailboxCache(),
          ...(parsed.mailboxes?.[key] ?? {}),
        };
        return acc;
      },
      {} as Record<Mailbox, MailboxCache>,
    );
    store.state = { mailboxes };
  } catch (error) {
    console.error("Impossible de restaurer le cache de messagerie:", error);
  }
}

const store = {
  state: initialState,
  listeners: new Set<Listener>(),
  getState(): StoreState {
    hydrateFromStorage();
    return this.state;
  },
  setState(
    nextState:
      | StoreState
      | ((previous: StoreState) => StoreState),
  ) {
    const computed =
      typeof nextState === "function"
        ? (nextState as (previous: StoreState) => StoreState)(
            this.state,
          )
        : nextState;
    this.state = computed;
    if (typeof window !== "undefined") {
      persistState(this.state);
    }
    this.listeners.forEach((listener) => listener());
  },
  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },
};

function computeLatestUid(messages: MailboxListItem[]): number | null {
  if (!messages.length) {
    return null;
  }
  return messages.reduce(
    (max, item) => (item.uid > max ? item.uid : max),
    messages[0]?.uid ?? 0,
  );
}

function mergeMessages(
  existing: MailboxListItem[],
  additions: MailboxListItem[],
): MailboxListItem[] {
  if (additions.length === 0) {
    return existing;
  }
  const map = new Map<number, MailboxListItem>();
  for (const item of existing) {
    map.set(item.uid, item);
  }
  for (const item of additions) {
    map.set(item.uid, item);
  }
  const merged = Array.from(map.values());
  merged.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return merged;
}

function updateMailbox(
  mailbox: Mailbox,
  updater: (previous: MailboxCache) => MailboxCache,
) {
  store.setState((previous) => {
    const current = previous.mailboxes[mailbox] ?? defaultMailboxCache();
    const nextMailbox = updater(current);
    if (nextMailbox === current) {
      return previous;
    }
    return {
      ...previous,
      mailboxes: {
        ...previous.mailboxes,
        [mailbox]: nextMailbox,
      },
    };
  });
}

function applyMetadata(
  mailbox: Mailbox,
  metadata: MailboxUpdateOptions,
) {
  updateMailbox(mailbox, (current) => ({
    ...current,
    page: metadata.page ?? current.page,
    pageSize: metadata.pageSize ?? current.pageSize,
    hasMore: metadata.hasMore ?? current.hasMore,
    lastSync: metadata.lastSync ?? current.lastSync,
    totalMessages:
      metadata.totalMessages ?? current.totalMessages,
    latestUid: computeLatestUid(current.messages),
  }));
}

export function initializeMailboxCache(
  mailbox: Mailbox,
  payload: {
    messages: MailboxListItem[];
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalMessages: number | null;
  },
) {
  updateMailbox(mailbox, () => ({
    messages: [...payload.messages],
    page: payload.page,
    pageSize: payload.pageSize,
    hasMore: payload.hasMore,
    initialized: true,
    lastSync: Date.now(),
    latestUid: computeLatestUid(payload.messages),
    totalMessages: payload.totalMessages,
  }));
}

export function replaceMailboxMessages(
  mailbox: Mailbox,
  payload: {
    messages: MailboxListItem[];
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalMessages: number | null;
  },
) {
  updateMailbox(mailbox, (current) => ({
    ...current,
    messages: [...payload.messages],
    page: payload.page,
    pageSize: payload.pageSize,
    hasMore: payload.hasMore,
    initialized: true,
    lastSync: Date.now(),
    latestUid: computeLatestUid(payload.messages),
    totalMessages: payload.totalMessages,
  }));
}

export function appendMailboxMessages(
  mailbox: Mailbox,
  additions: MailboxListItem[],
  metadata: MailboxUpdateOptions = {},
) {
  if (!additions.length && !Object.keys(metadata).length) {
    return;
  }
  updateMailbox(mailbox, (current) => {
    const mergedMessages = additions.length
      ? mergeMessages(current.messages, additions)
      : current.messages;
    return {
      ...current,
      messages: mergedMessages,
      page: metadata.page ?? current.page,
      pageSize: metadata.pageSize ?? current.pageSize,
      hasMore: metadata.hasMore ?? current.hasMore,
      lastSync: metadata.lastSync ?? Date.now(),
      latestUid: computeLatestUid(mergedMessages),
      totalMessages:
        metadata.totalMessages ?? current.totalMessages,
    };
  });
}

export function markMailboxMessageSeen(
  mailbox: Mailbox,
  uid: number,
) {
  updateMailbox(mailbox, (current) => {
    const index = current.messages.findIndex(
      (item) => item.uid === uid,
    );
    if (index === -1) {
      return current;
    }
    const updatedMessages = [...current.messages];
    updatedMessages[index] = {
      ...updatedMessages[index],
      seen: true,
    };
    return {
      ...current,
      messages: updatedMessages,
    };
  });
}

export function updateMailboxMetadata(
  mailbox: Mailbox,
  metadata: MailboxUpdateOptions,
) {
  applyMetadata(mailbox, metadata);
}

export function removeMailboxMessage(mailbox: Mailbox, uid: number) {
  updateMailbox(mailbox, (current) => {
    const filtered = current.messages.filter((item) => item.uid !== uid);
    if (filtered.length === current.messages.length) {
      return current;
    }
    return {
      ...current,
      messages: filtered,
      latestUid: computeLatestUid(filtered),
      totalMessages:
        typeof current.totalMessages === "number"
          ? Math.max(0, current.totalMessages - 1)
          : current.totalMessages,
    } satisfies MailboxCache;
  });
}

export function resetMailboxCache(mailbox: Mailbox) {
  updateMailbox(mailbox, () => defaultMailboxCache());
}

export function invalidateMailboxCache(mailbox: Mailbox) {
  updateMailbox(mailbox, (current) => ({
    ...current,
    initialized: false,
  }));
}

export function getMailboxStoreSnapshot() {
  return store.getState();
}

export function useMailboxStore<T>(
  selector: (state: StoreState) => T,
): T {
  hydrateFromStorage();
  return useSyncExternalStore(
    store.subscribe.bind(store),
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
