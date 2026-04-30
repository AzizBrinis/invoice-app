ALTER TABLE public."MessagingSettings"
  ADD COLUMN IF NOT EXISTS "autoForwardEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoForwardRecipients" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public."MessagingInboxSyncState"
  ADD COLUMN IF NOT EXISTS "lastInboxAutoForwardUid" integer;

UPDATE public."MessagingSettings"
SET "autoForwardRecipients" = COALESCE(
  (
    SELECT jsonb_agg(cleaned.entry)
    FROM (
      SELECT lower(btrim(part.entry, ' "[]')) AS entry
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof("autoForwardRecipients") = 'array'
            THEN "autoForwardRecipients"
          WHEN jsonb_typeof("autoForwardRecipients") = 'string'
            THEN jsonb_build_array("autoForwardRecipients" #>> '{}')
          ELSE '[]'::jsonb
        END
      ) AS source(entry)
      CROSS JOIN regexp_split_to_table(source.entry, '[,;\n]+') AS part(entry)
    ) AS cleaned
    WHERE cleaned.entry <> ''
  ),
  '[]'::jsonb
)
WHERE
  jsonb_typeof("autoForwardRecipients") IS DISTINCT FROM 'array'
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof("autoForwardRecipients") = 'array'
          THEN "autoForwardRecipients"
        WHEN jsonb_typeof("autoForwardRecipients") = 'string'
          THEN jsonb_build_array("autoForwardRecipients" #>> '{}')
        ELSE '[]'::jsonb
      END
    ) AS source(entry)
    WHERE source.entry ~ '[\[\]"]'
  );

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

UPDATE public."MessagingAutoForwardLog"
SET
  "targetRecipients" = COALESCE(
    (
      SELECT jsonb_agg(cleaned.entry)
      FROM (
        SELECT lower(btrim(part.entry, ' "[]')) AS entry
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof("targetRecipients") = 'array'
              THEN "targetRecipients"
            WHEN jsonb_typeof("targetRecipients") = 'string'
              THEN jsonb_build_array("targetRecipients" #>> '{}')
            ELSE '[]'::jsonb
          END
        ) AS source(entry)
        CROSS JOIN regexp_split_to_table(source.entry, '[,;\n]+') AS part(entry)
      ) AS cleaned
      WHERE cleaned.entry <> ''
    ),
    '[]'::jsonb
  ),
  "sentRecipients" = COALESCE(
    (
      SELECT jsonb_agg(cleaned.entry)
      FROM (
        SELECT lower(btrim(part.entry, ' "[]')) AS entry
        FROM jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof("sentRecipients") = 'array'
              THEN "sentRecipients"
            WHEN jsonb_typeof("sentRecipients") = 'string'
              THEN jsonb_build_array("sentRecipients" #>> '{}')
            ELSE '[]'::jsonb
          END
        ) AS source(entry)
        CROSS JOIN regexp_split_to_table(source.entry, '[,;\n]+') AS part(entry)
      ) AS cleaned
      WHERE cleaned.entry <> ''
    ),
    '[]'::jsonb
  )
WHERE
  jsonb_typeof("targetRecipients") IS DISTINCT FROM 'array'
  OR jsonb_typeof("sentRecipients") IS DISTINCT FROM 'array'
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof("targetRecipients") = 'array'
          THEN "targetRecipients"
        WHEN jsonb_typeof("targetRecipients") = 'string'
          THEN jsonb_build_array("targetRecipients" #>> '{}')
        ELSE '[]'::jsonb
      END
    ) AS source(entry)
    WHERE source.entry ~ '[\[\]"]'
  )
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof("sentRecipients") = 'array'
          THEN "sentRecipients"
        WHEN jsonb_typeof("sentRecipients") = 'string'
          THEN jsonb_build_array("sentRecipients" #>> '{}')
        ELSE '[]'::jsonb
      END
    ) AS source(entry)
    WHERE source.entry ~ '[\[\]"]'
  );
