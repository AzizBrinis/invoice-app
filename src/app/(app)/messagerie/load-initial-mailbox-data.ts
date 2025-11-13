import { cache } from "react";
import {
  fetchMailboxMessages,
  type Mailbox,
  type MailboxPageResult,
} from "@/server/messaging";

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
