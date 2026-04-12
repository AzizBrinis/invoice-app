-- One-off production-safe cleanup and indexing pass after the Prisma removal.
-- Run with psql in autocommit mode:
--   psql "$DIRECT_URL" -f scripts/sql/20260411_db_optimization.sql

-- The legacy Prisma shadow schema is no longer referenced anywhere in the app.
DROP SCHEMA IF EXISTS shadow CASCADE;

-- Replace the unused per-job event index with the access path the app actually uses
-- for /api/jobs/metrics (latest events first).
DROP INDEX CONCURRENTLY IF EXISTS public."BackgroundJobEvent_jobId_createdAt_idx";
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BackgroundJobEvent_createdAt_idx"
  ON public."BackgroundJobEvent" ("createdAt" DESC);

-- Mark abandoned periodic jobs as failed so they stop inflating RUNNING counts.
WITH stale_periodic_jobs AS (
  SELECT id
  FROM public."BackgroundJob"
  WHERE status = 'RUNNING'
    AND "lockedAt" < now() - interval '60 minutes'
    AND (
      type = 'messaging.dispatchScheduledEmails'
      OR type = 'messaging.syncInboxAutoReplies'
      OR type LIKE 'messaging.localSync%'
    )
)
INSERT INTO public."BackgroundJobEvent" (id, "jobId", type, detail)
SELECT
  'recovery_' || replace(gen_random_uuid()::text, '-', ''),
  id,
  'FAILED',
  jsonb_build_object(
    'reason', 'stale-running-recovery',
    'message', 'Job périodique abandonné après expiration du lease; un cycle plus récent le remplacera.',
    'recoveredAt', now()
  )
FROM stale_periodic_jobs;

WITH stale_periodic_jobs AS (
  SELECT id
  FROM public."BackgroundJob"
  WHERE status = 'RUNNING'
    AND "lockedAt" < now() - interval '60 minutes'
    AND (
      type = 'messaging.dispatchScheduledEmails'
      OR type = 'messaging.syncInboxAutoReplies'
      OR type LIKE 'messaging.localSync%'
    )
)
UPDATE public."BackgroundJob"
SET
  status = 'FAILED',
  "lastError" = 'Job périodique abandonné après expiration du lease; un cycle plus récent le remplacera.',
  "completedAt" = now(),
  "lockedAt" = NULL
WHERE id IN (SELECT id FROM stale_periodic_jobs);

-- Keep only recent completed job history. The app never reads older terminal rows.
DELETE FROM public."BackgroundJob"
WHERE status IN ('SUCCEEDED', 'FAILED', 'CANCELLED')
  AND "completedAt" < now() - interval '30 days';

DELETE FROM public."BackgroundJobEvent"
WHERE "createdAt" < now() - interval '30 days';

-- Sent/cancelled scheduled e-mails are not surfaced anywhere in the UI and
-- attachment rows cascade on delete, so keep only recent history.
DELETE FROM public."MessagingScheduledEmail"
WHERE status IN ('SENT', 'CANCELLED')
  AND COALESCE("sentAt", "canceledAt", "createdAt") < now() - interval '30 days';

ANALYZE public."BackgroundJob";
ANALYZE public."BackgroundJobEvent";
ANALYZE public."MessagingScheduledEmail";
