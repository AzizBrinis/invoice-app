import {
  fetchMessageDetail,
  getMessagingSettingsSummary,
  type Mailbox,
} from "@/server/messaging";
import { listSavedResponses } from "@/server/messaging-responses";
import { ComposeClient } from "@/app/(app)/messagerie/_components/compose-client";
import {
  parseRecipientHeaders,
} from "@/lib/messaging/recipients";
import {
  buildInitialComposeDraft,
  type ComposeInitialDraft,
} from "@/lib/messaging/compose-draft";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type NouveauMessagePageProps = { searchParams?: Promise<SearchParams> };

const SUPPORTED_MAILBOXES: Mailbox[] = ["inbox", "sent"];

function isSupportedMailbox(value: string | undefined): value is Mailbox {
  return !!value && SUPPORTED_MAILBOXES.includes(value as Mailbox);
}

export default async function NouveauMessagePage({
  searchParams,
}: NouveauMessagePageProps) {
  const summary = await getMessagingSettingsSummary();
  const companySettings = await getSettings();

  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const modeParam =
    typeof resolvedSearchParams.mode === "string"
      ? resolvedSearchParams.mode
      : undefined;
  const mailboxParam =
    typeof resolvedSearchParams.mailbox === "string"
      ? (resolvedSearchParams.mailbox as string)
      : undefined;
  const uidParam =
    typeof resolvedSearchParams.uid === "string" ? resolvedSearchParams.uid : undefined;

  let initialDraft: ComposeInitialDraft | null = null;
  let replyContext: { mailbox: Mailbox; uid: number } | null = null;

  if (modeParam && mailboxParam && uidParam && isSupportedMailbox(mailboxParam)) {
    const uidValue = Number.parseInt(uidParam, 10);
    if (Number.isInteger(uidValue)) {
      try {
        const detail = await fetchMessageDetail({
          mailbox: mailboxParam,
          uid: uidValue,
        });
        initialDraft = buildInitialComposeDraft(
          modeParam,
          detail,
          summary.fromEmail,
        );
        if (
          initialDraft &&
          (modeParam === "reply" || modeParam === "reply_all")
        ) {
          replyContext = { mailbox: mailboxParam, uid: uidValue };
        }
      } catch (error) {
        console.error("Impossible de préparer la réponse:", error);
      }
    }
  }

  const savedResponses = await listSavedResponses();
  const companyPlaceholderValues = {
    company_name: companySettings.companyName?.trim() ?? "",
    company_email: companySettings.email?.trim() ?? "",
    company_phone: companySettings.phone?.trim() ?? "",
    company_address: companySettings.address?.trim() ?? "",
  };

  if (!initialDraft) {
    const toParam = resolvedSearchParams.to;
    const rawValues = Array.isArray(toParam) ? toParam : toParam ? [toParam] : [];
    const parsedRecipients = parseRecipientHeaders(
      rawValues.flatMap((value) => {
        if (typeof value !== "string") {
          return [];
        }
        return value
          .split(/[;,]/)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
      }),
    );
    if (parsedRecipients.length > 0) {
      initialDraft = {
        to: parsedRecipients,
        body: "",
      };
    }
  }

  return (
    <ComposeClient
      fromEmail={summary.fromEmail}
      senderName={summary.senderName}
      smtpConfigured={summary.smtpConfigured}
      initialDraft={initialDraft}
      savedResponses={savedResponses}
      companyPlaceholders={companyPlaceholderValues}
      replyContext={replyContext}
    />
  );
}
