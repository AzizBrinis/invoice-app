import { cache } from "react";
import {
  fetchMailboxMessages,
  searchMailboxMessages,
  type Mailbox,
  type MailboxPageResult,
  type MailboxSearchResult,
} from "@/server/messaging";
import {
  isMailboxSearchQueryUsable,
  isMailboxSearchable,
  normalizeMailboxSearchQuery,
} from "@/lib/messaging/mailbox-search";

type LoadMailboxOptions = {
  mailbox: Mailbox;
  enabled: boolean;
  fallbackError: string;
};

const fetchInitialPage = cache(
  async (mailbox: Mailbox): Promise<MailboxPageResult> => {
    return fetchMailboxMessages({
      mailbox,
      page: 1,
    });
  },
);

export async function loadInitialMailboxData({
  mailbox,
  enabled,
  fallbackError,
}: LoadMailboxOptions): Promise<{
  initialPage: MailboxPageResult | null;
  initialError: string | null;
}> {
  if (!enabled) {
    return {
      initialPage: null,
      initialError: null,
    };
  }
  try {
    const page = await fetchInitialPage(mailbox);
    return {
      initialPage: page,
      initialError: null,
    };
  } catch (error) {
    const message =
      error instanceof Error && typeof error.message === "string"
        ? error.message
        : fallbackError;
    return {
      initialPage: null,
      initialError: message,
    };
  }
}

export async function loadInitialMailboxSearchData({
  mailbox,
  query,
  enabled,
  fallbackError,
}: {
  mailbox: Mailbox;
  query: string | null | undefined;
  enabled: boolean;
  fallbackError: string;
}): Promise<{
  initialSearchPage: MailboxSearchResult | null;
  initialSearchError: string | null;
  initialSearchQuery: string;
}> {
  const normalizedQuery = normalizeMailboxSearchQuery(query);
  if (
    !enabled ||
    !isMailboxSearchable(mailbox) ||
    !isMailboxSearchQueryUsable(normalizedQuery)
  ) {
    return {
      initialSearchPage: null,
      initialSearchError: null,
      initialSearchQuery: normalizedQuery,
    };
  }

  try {
    const initialSearchPage = await searchMailboxMessages({
      mailbox,
      query: normalizedQuery,
      page: 1,
    });
    return {
      initialSearchPage,
      initialSearchError: null,
      initialSearchQuery: normalizedQuery,
    };
  } catch (error) {
    const message =
      error instanceof Error && typeof error.message === "string"
        ? error.message
        : fallbackError;
    return {
      initialSearchPage: null,
      initialSearchError: message,
      initialSearchQuery: normalizedQuery,
    };
  }
}
