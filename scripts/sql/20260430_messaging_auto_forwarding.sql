ALTER TABLE public."MessagingSettings"
  ADD COLUMN IF NOT EXISTS "autoForwardEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoForwardRecipients" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public."MessagingInboxSyncState"
  ADD COLUMN IF NOT EXISTS "lastInboxAutoForwardUid" integer;

CREATE TABLE IF NOT EXISTS public."MessagingAutoForwardLog" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES public."User" ("id") ON DELETE CASCADE,
  "mailbox" text NOT NULL DEFAULT 'inbox',
  "uidValidity" integer NOT NULL,
  "uid" integer NOT NULL,
  "messageId" text,
  "subject" text,
  "targetRecipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sentRecipients" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'SENDING',
  "attempts" integer NOT NULL DEFAULT 0,
  "lastAttemptAt" timestamptz,
  "nextAttemptAt" timestamptz,
  "sentAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT "MessagingAutoForwardLog_mailbox_check"
    CHECK ("mailbox" IN ('inbox')),
  CONSTRAINT "MessagingAutoForwardLog_status_check"
    CHECK ("status" IN ('SENDING', 'SENT', 'FAILED', 'SKIPPED')),
  CONSTRAINT "MessagingAutoForwardLog_attempts_check"
    CHECK ("attempts" >= 0),
  CONSTRAINT "MessagingAutoForwardLog_uid_check"
    CHECK ("uid" > 0),
  CONSTRAINT "MessagingAutoForwardLog_uidValidity_check"
    CHECK ("uidValidity" > 0),
  CONSTRAINT "MessagingAutoForwardLog_user_mailbox_uid_key"
    UNIQUE ("userId", "mailbox", "uidValidity", "uid")
);

CREATE INDEX IF NOT EXISTS "MessagingAutoForwardLog_user_status_nextAttempt_idx"
  ON public."MessagingAutoForwardLog" ("userId", "status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "MessagingAutoForwardLog_status_nextAttempt_idx"
  ON public."MessagingAutoForwardLog" ("status", "nextAttemptAt");

