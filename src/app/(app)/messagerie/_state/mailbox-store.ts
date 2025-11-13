import { useSyncExternalStore } from "react";
import type {
  Mailbox,
  MailboxListItem,
  MessageDetail,
} from "@/server/messaging";

export const MAILBOX_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
export const MAILBOX_DETAIL_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  syncing: boolean;
  active: boolean;
};

type CachedMessageDetail = {
  detail: MessageDetail;
  fetchedAt: number;
};

type StoreState = {
  mailboxes: Record<Mailbox, MailboxCache>;
  messageDetails: Record<Mailbox, Record<number, CachedMessageDetail>>;
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
  syncing: false,
  active: false,
});

function createEmptyDetailsState(): Record<Mailbox, Record<number, CachedMessageDetail>> {
  return MAILBOX_KEYS.reduce<Record<Mailbox, Record<number, CachedMessageDetail>>>(
    (acc, key) => {
      acc[key] = {};
      return acc;
    },
    {} as Record<Mailbox, Record<number, CachedMessageDetail>>,
  );
}

const STORAGE_KEY_PREFIX = "mailbox-cache-v2";

let activeUserId: string | null = null;

function buildStorageKey(userId: string | null) {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

function getActiveStorageKey() {
  return buildStorageKey(activeUserId);
}

function createInitialState(): StoreState {
  const entries = MAILBOX_KEYS.reduce<Record<Mailbox, MailboxCache>>(
    (acc, key) => {
      acc[key] = defaultMailboxCache();
      return acc;
    },
    {} as Record<Mailbox, MailboxCache>,
  );
  return {
    mailboxes: entries,
    messageDetails: createEmptyDetailsState(),
  };
}

const initialState: StoreState = createInitialState();

type Listener = () => void;

let hasHydratedFromStorage = false;
let hydratedStorageKey: string | null = null;

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
  const storageKey = getActiveStorageKey();
  try {
    storage.setItem(
      storageKey,
      JSON.stringify({
        mailboxes: state.mailboxes,
      }),
    );
  } catch (error) {
    console.error("Impossible de persister le cache de messagerie:", error);
  }
}

function hydrateFromStorage() {
  const storageKey = getActiveStorageKey();
  if (hasHydratedFromStorage && hydratedStorageKey === storageKey) {
    return;
  }
  hasHydratedFromStorage = true;
  hydratedStorageKey = storageKey;
  const storage = getStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(storageKey);
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
    store.state = {
      mailboxes,
      messageDetails: createEmptyDetailsState(),
    };
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

export function setMailboxCacheUser(userId: string | null) {
  const normalizedUserId = userId ?? null;
  if (normalizedUserId === activeUserId) {
    return;
  }
  activeUserId = normalizedUserId;
  store.setState(createInitialState());
  hasHydratedFromStorage = false;
  hydratedStorageKey = null;
}

export function clearMailboxCache(userId?: string | null) {
  const targetUserId =
    typeof userId === "undefined" ? activeUserId : userId ?? null;
  const storageKey = buildStorageKey(targetUserId);
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(storageKey);
    } catch (error) {
      console.error(
        "Impossible de supprimer le cache de messagerie:",
        error,
      );
    }
  }
  if (targetUserId === activeUserId) {
    store.setState(createInitialState());
    hasHydratedFromStorage = false;
    hydratedStorageKey = null;
  }
}

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
    syncing: false,
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
    syncing: false,
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
    const existingUids = new Set(
      current.messages.map((item) => item.uid),
    );
    let uniqueAdditions = 0;
    for (const item of additions) {
      if (!existingUids.has(item.uid)) {
        uniqueAdditions += 1;
      }
    }
    const mergedMessages = additions.length
      ? mergeMessages(current.messages, additions)
      : current.messages;
    const nextTotal =
      typeof metadata.totalMessages === "number"
        ? metadata.totalMessages
        : typeof current.totalMessages === "number" && uniqueAdditions
          ? current.totalMessages + uniqueAdditions
          : current.totalMessages;
    return {
      ...current,
      messages: mergedMessages,
      page: metadata.page ?? (current.initialized ? current.page : 1),
      pageSize: metadata.pageSize ?? current.pageSize,
      hasMore: metadata.hasMore ?? current.hasMore,
      lastSync: metadata.lastSync ?? Date.now(),
      latestUid: computeLatestUid(mergedMessages),
      totalMessages: nextTotal,
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

export function isMailboxCacheStale(cache: MailboxCache | undefined, now: number = Date.now()) {
  if (!cache || !cache.initialized || cache.lastSync === null) {
    return true;
  }
  return now - cache.lastSync > MAILBOX_CACHE_TTL_MS;
}

export function cacheMessageDetail(
  mailbox: Mailbox,
  detail: MessageDetail,
) {
  store.setState((previous) => ({
    ...previous,
    messageDetails: {
      ...previous.messageDetails,
      [mailbox]: {
        ...previous.messageDetails[mailbox],
        [detail.uid]: {
          detail,
          fetchedAt: Date.now(),
        },
      },
    },
  }));
}

export function getCachedMessageDetail(mailbox: Mailbox, uid: number) {
  const entry = store.getState().messageDetails[mailbox]?.[uid];
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.fetchedAt > MAILBOX_DETAIL_TTL_MS) {
    return null;
  }
  return entry.detail;
}

export function markMailboxActive(mailbox: Mailbox) {
  updateMailbox(mailbox, (current) =>
    current.active
      ? current
      : {
          ...current,
          active: true,
        },
  );
}

export function beginMailboxSync(mailbox: Mailbox): boolean {
  let acquired = false;
  updateMailbox(mailbox, (current) => {
    if (current.syncing) {
      return current;
    }
    acquired = true;
    return {
      ...current,
      syncing: true,
    };
  });
  return acquired;
}

export function endMailboxSync(mailbox: Mailbox) {
  updateMailbox(mailbox, (current) =>
    current.syncing
      ? {
          ...current,
          syncing: false,
        }
      : current,
  );
}
