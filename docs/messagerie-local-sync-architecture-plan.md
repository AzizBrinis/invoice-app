# Messagerie Optional Local Sync / Local Cache Architecture Plan

## 1. Feature summary

The proposed feature is an optional Messagerie mode where IMAP mailboxes are synchronized into the application database and the Messagerie UI reads primarily from that local data instead of reading live from IMAP for every daily interaction.

IMAP remains the remote source of truth and synchronization layer. The feature does not replace IMAP, does not become the default behavior, and must stay disabled unless the user explicitly enables it from Messagerie settings.

This is being considered because the current Messagerie experience is still fundamentally IMAP-bound during normal usage. Folder navigation, message opening, search, and attachment access all still depend on live IMAP connections and message parsing, which creates avoidable latency and variability.

Based on the current codebase, this is a strong direction for the stated performance problem, but only if it is implemented as a production local read-model with safe fallback behavior, background synchronization, explicit status, and careful storage boundaries. It should not be implemented as a naive full mailbox mirror or as a hard replacement for the current live strategy.

## 2. Findings from the current implementation

### 2.1 How Messagerie currently works

- The main mailbox read/write logic is concentrated in `src/server/messaging.ts`.
- Mailbox pages under `src/app/(app)/messagerie/*/page.tsx` server-render page 1 by calling `loadInitialMailboxData()` or `loadInitialMailboxSearchData()`, which then call live IMAP-backed server functions.
- The client shell in `src/app/(app)/messagerie/_components/mailbox-client.tsx` handles:
  - message listing
  - message detail loading
  - pagination
  - search
  - refresh
  - move-to-folder actions
  - attachment preview/download
  - AI summary
- The client store in `src/app/(app)/messagerie/_state/mailbox-store.ts` is only a short-lived session cache:
  - mailbox list state is persisted in `sessionStorage`
  - mailbox list TTL is 2 minutes
  - message detail TTL is 5 minutes
  - message details are not persisted to storage
- The background sync provider in `src/app/(app)/messagerie/_components/mailbox-sync-provider.tsx` polls from the browser every 3 minutes, plus on focus/visibility return.
- That browser sync only keeps:
  - `inbox` always active
  - the currently viewed mailbox active
- Messaging settings are stored in `MessagingSettings` in `prisma/schema.prisma`.
- Credentials are encrypted server-side through `src/server/secure-credentials.ts`.

### 2.2 How IMAP is currently used

- Every main mailbox operation currently resolves settings, creates a fresh IMAP client, connects, opens a mailbox, performs the operation, and logs out through `withImapClient()` in `src/server/messaging.ts`.
- The current live IMAP server functions include:
  - `fetchMailboxMessages()`
  - `fetchMailboxUpdates()`
  - `searchMailboxMessages()`
  - `fetchMessageDetail()`
  - `fetchMessageAttachment()`
  - `moveMailboxMessage()`
  - sent-mail append after SMTP send
- Mailbox path resolution for `sent`, `drafts`, `trash`, and `spam` is dynamic and provider-dependent. The app uses mailbox discovery and in-memory mailbox-path caching keyed by connection data.
- The app currently exposes only five logical mailbox sections:
  - `inbox`
  - `sent`
  - `drafts`
  - `trash`
  - `spam`
- There is no current UI for arbitrary custom IMAP folder trees.

### 2.3 How emails, folders, navigation, fetching, caching, attachments, search, and state are currently handled

- Navigation to a mailbox route triggers a server fetch for page 1 from IMAP.
- The client mailbox store then keeps the currently loaded list pages in session storage for the active tenant/account.
- “Load more” requests fetch another live IMAP page and append it into the client store.
- Message detail opens are on-demand:
  - `fetchMessageDetail()` fetches the full message source from IMAP
  - `simpleParser()` parses the full RFC822 source
  - HTML is sanitized before display
- Attachment preview/download is also on-demand:
  - `fetchMessageAttachment()` fetches the full message source again
  - the app parses the message again
  - attachment content is then extracted
- Search is live IMAP search today:
  - supported only on `inbox` and `sent`
  - query normalization lives in `src/lib/messaging/mailbox-search.ts`
  - multi-term search is implemented by multiple IMAP searches plus UID intersection
- Sent messages are handled differently from received messages:
  - send path is SMTP-backed
  - tracking metadata is persisted in database tables such as `MessagingEmail`
  - the sent message is then appended to the IMAP sent mailbox
  - sent mailbox rows are enriched with tracking data by `messageId`
- Spam handling currently happens during mailbox fetch/update for inbox:
  - inbox reads can trigger spam analysis
  - messages can be auto-moved during fetch
- Auto-replies currently rely on a mix of cron-driven jobs and inbox sync state in `MessagingInboxSyncState`.

### 2.4 Current bottlenecks and limitations relevant to this idea

- The hottest mailbox interactions still depend on live IMAP.
- The current client-side cache is helpful but shallow:
  - it is per-session
  - it is short-lived
  - it is not a durable mailbox cache
- Every mailbox detail fetch reparses the full source.
- Every attachment fetch reparses the full source again.
- Search remains expensive and IMAP-dependent.
- Live IMAP is still on the hot path for:
  - initial route navigation
  - refresh
  - load more
  - search
  - message open
  - attachment preview/download
  - background mailbox updates
- Browser background sync only detects a narrow class of changes well:
  - new messages after the latest UID
  - total count drops that trigger a snapshot refresh
- The current delta update path does not provide strong coverage for changes on already known messages, such as:
  - flag changes on existing messages
  - remote read/unread changes on older UIDs
  - other metadata drift that does not change `uidNext`
- Opening a message currently marks it as seen only in the client store through `markMailboxMessageSeen()`; it does not write `\Seen` back to IMAP.
- Search only exists on `inbox` and `sent`, which is coherent with the current UI but is still a product constraint.
- The current architecture still pays connection/open/parse cost even after the recent optimization pass documented in `docs/messagerie-optimization-pass.md`.

### 2.5 Architectural constraints from the real codebase

- The application now runs on PostgreSQL, not SQLite.
- Messaging background work already uses the existing app job queue and `/api/cron/messaging`.
- `src/server/messaging-scheduled.ts` explicitly rejects the old always-on worker model and expects cron-triggered serverless-compatible processing.
- The current GitHub Actions cron at `.github/workflows/messaging-cron.yml` runs every 5 minutes.
- This means the local-sync feature should fit a cron/job model plus on-demand sync hooks. It should not assume a permanently running IMAP IDLE worker.
- Messaging/account scoping already matters:
  - `resolveUserId()` in `src/server/messaging.ts` uses `activeTenantId ?? tenantId ?? id`
  - any local sync tables must follow the same account/tenant identity, not the raw session user id
- There are already database-backed messaging features worth reusing:
  - email tracking
  - scheduled emails
  - saved responses
  - auto-reply sync state
  - spam logs
- There is no current database model for cached mailbox messages, message bodies, mailbox cursors, or attachment cache.

## 3. Production-ready design proposal

### 3.1 Recommended overall approach

Implement local sync as an optional database-backed read model for the five existing logical mailboxes. Keep the current live IMAP implementation intact as the default mode and as the fallback mode.

When local sync is enabled:

- mailbox lists should read from local database data
- message detail should read from local database data when available
- search should prefer local database search
- refresh should trigger synchronization, then reread local data
- IMAP remains authoritative for:
  - synchronization
  - mailbox mutations
  - remote folder state
  - attachment binary retrieval unless explicitly cached

### 3.2 Activation, deactivation, and coexistence with the current strategy

- Add a new setting in Messagerie settings, inside a dedicated “Performance / synchronisation locale” section.
- The setting should be off by default.
- Default-off behavior is mandatory:
  - users who do nothing keep today’s live IMAP behavior
  - no mailbox data is locally synchronized unless they opt in
- Enabling the setting should:
  - create local sync state records
  - start bootstrap synchronization
  - immediately expose sync status in settings
  - switch mailbox reads to the local mode only when the current mailbox has enough bootstrap data to be usable
- Disabling the setting should:
  - immediately switch reads back to the current live IMAP strategy
  - stop scheduling future local sync jobs
  - queue background purge of locally synchronized message data
  - keep the current live Messagerie fully usable even if purge is still running

### 3.3 Recommended data model

The following model is the safest fit for the current architecture.

- Extend `MessagingSettings` with at least:
  - `localSyncEnabled Boolean @default(false)`
  - optional fields for user-visible sync preferences if needed later
- Add a mailbox sync state table, for example `MessagingMailboxLocalSyncState`:
  - account/tenant id
  - logical mailbox enum (`inbox`, `sent`, `drafts`, `trash`, `spam`)
  - resolved remote mailbox path
  - IMAP UID validity
  - last successful sync time
  - last attempted sync time
  - status (`DISABLED`, `BOOTSTRAPPING`, `READY`, `DEGRADED`, `ERROR`)
  - cursor fields for incremental sync
  - progress counters for bootstrap/backfill
  - last error summary
- Add a local message table, for example `MessagingLocalMessage`:
  - account/tenant id
  - logical mailbox enum
  - resolved remote mailbox path
  - IMAP UID
  - IMAP UID validity
  - `messageId`
  - subject
  - sender and recipients
  - message date/internal date
  - flags needed by the current UI (`seen`, `answered`, `flagged`, `draft`, deleted marker if needed)
  - `hasAttachments`
  - local preview text
  - normalized plain text body for search and text fallback
  - sanitized HTML body when hydrated
  - body availability state (`NONE`, `TEXT_READY`, `HTML_READY`, `OVERSIZED_FALLBACK`)
  - sync timestamps
  - optional hash/checksum fields for reconciliation
- Add a local attachment table, for example `MessagingLocalAttachment`:
  - parent local message id
  - attachment id/checksum
  - filename
  - content type
  - size
  - inline/content-id metadata if needed later
  - optional local blob cache pointer if binary caching is introduced
- Add indexes that support the real read paths:
  - account + mailbox + date desc
  - account + mailbox + UID validity + UID unique
  - account + `messageId`
  - search indexes on subject, sender, recipients, and normalized plain text

Important identity rule:

- `messageId` must not be the only uniqueness key.
- The primary remote identity should be mailbox-scoped IMAP identity:
  - account/tenant id
  - logical mailbox
  - UID validity
  - UID
- `messageId` should remain a correlation key for:
  - sent tracking joins
  - duplicate hints
  - move/reconciliation heuristics

### 3.4 What should be stored locally

Store locally:

- envelope metadata needed for mailbox lists
- recipients/participants needed for detail and reply flows
- IMAP identifiers and flags
- preview text
- normalized plain text body
- sanitized HTML body for recent or opened messages
- attachment metadata
- the `messageId` needed for sent tracking enrichment

Do not store by default:

- full raw RFC822 source for every message
- binary attachment content for every attachment

Recommended storage policy:

- always store metadata and normalized plain text
- store sanitized HTML during bootstrap for the newest working set and then lazily persist it for older messages when they are opened
- keep attachment binaries IMAP-driven and on-demand
- optionally add a bounded attachment/blob cache later, but do not make that part of the initial core design

This gives a better storage/performance balance than mirroring every raw payload and every attachment into Postgres.

### 3.5 What should remain IMAP-driven

Even in local mode, IMAP should remain responsible for:

- synchronization source of truth
- remote mailbox mutations
- remote folder membership truth
- binary attachment retrieval unless a specific attachment was explicitly cached
- recovery when local data is missing, stale, or partially hydrated

Specific feature behavior:

- mailbox move actions should still perform the real IMAP move first
- read/unread flag changes should still be written back to IMAP when local mode owns that state
- fallback detail hydration for missing HTML/body should still come from IMAP

### 3.6 High-level sync behavior

The sync pipeline should reuse the existing mailbox discovery/opening logic from `src/server/messaging.ts`, but write into local tables instead of returning only ephemeral page payloads.

Recommended sync stages:

1. Enable local sync.
2. Create sync state per logical mailbox.
3. Bootstrap recent history first:
   - prioritize `inbox` and `sent`
   - then `drafts`, `trash`, `spam`
4. Mark a mailbox usable once the first working window is synchronized.
5. Continue older-history backfill in background.
6. Run recurring delta sync jobs.
7. Run periodic reconciliation jobs to detect drift, deletions, flag changes, or UID validity resets.

Recommended bootstrap policy:

- do not block the feature on full mailbox history
- bootstrap a recent, useful working set first
- continue full-history backfill in the background if the product wants full retention

This avoids long “all or nothing” first syncs on large mailboxes while still keeping the design production-ready.

### 3.7 Sync frequency, first sync, re-sync, and manual sync

First sync:

- starts immediately after opt-in
- should show clear status per mailbox
- should show that recent history becomes available before full backfill completes

Recurring sync:

- reuse the existing cron/job architecture
- the existing cron currently runs every 5 minutes
- if that cadence is kept, add on-demand sync triggers on mailbox open/focus/manual refresh so users do not wait up to 5 minutes for freshness
- if product wants closer-to-real-time behavior, tighten cron only for users who enabled local sync and only after load testing

Manual sync:

- the current “Actualiser” button should trigger a local-sync refresh when local mode is enabled
- manual sync should:
  - request an immediate sync for the current mailbox
  - update visible sync status
  - reread the page from local DB after the sync step completes or times out

Re-sync and reconciliation:

- recent-window reconciliation should run more frequently than full-history reconciliation
- a slower scheduled full reconciliation should detect:
  - remote deletions
  - remote moves
  - flag drift
  - UID validity resets

### 3.8 Read-path behavior by feature

Inbox, sent, drafts, trash, spam:

- read from the local DB when local sync is enabled and the mailbox is at least bootstrap-ready
- paginate locally
- preserve the current route structure and UI behavior

Message detail:

- read from `MessagingLocalMessage`
- if the local record lacks hydrated HTML, fetch the message once from IMAP, persist the hydrated body, and serve it
- after hydration, future opens are local

Search:

- preserve the current UI behavior first: search surfaces stay `inbox` and `sent`
- use local DB search once a mailbox is sufficiently synchronized
- if the mailbox is still in bootstrap/backfill state, show that results are limited to synchronized content or fall back to live IMAP search
- local search should be based on:
  - subject
  - sender/recipient fields
  - normalized plain text

Unread/read state:

- in local mode, opening a message should update local read state immediately
- queue a write-back to IMAP so local and remote state converge
- if IMAP write-back fails, mark the mailbox degraded and reconcile on the next sync
- note that this is stricter and more durable than today’s default live mode, which currently only marks the message seen inside the client store

Flags and folder membership:

- store the flags needed by the current UI
- keep the schema flexible enough for more flags later
- moving a message should:
  - perform the IMAP move
  - update the local source mailbox immediately
  - invalidate or refresh the target mailbox locally
  - be confirmed by the next sync

Attachments:

- store metadata locally
- retrieve binary content on demand from IMAP
- avoid reparsing the full message on every attachment access once the message body is already hydrated locally
- optionally add bounded binary caching later if usage data justifies it

Sent messages:

- keep existing SMTP + tracking flow
- after send, write/update the local sent read-model immediately using the known message metadata and `messageId`
- finalize the remote IMAP UID/path when the append succeeds or when the next sent sync confirms it
- keep the current tracking join strategy via `messageId`

Spam and auto-replies:

- move these concerns into the sync pipeline for local mode
- inbox messages should be spam-checked before they become normal local inbox rows
- auto-reply processing should use the same synchronized inbox ingress flow or the existing cron job path, not depend on live page renders

Reply / forward flows:

- reply draft building should prefer the local message detail if present
- if local detail is incomplete, hydrate from IMAP once and persist it
- this keeps the existing reply/forward UX while making it faster over time

Drafts:

- the current product reads IMAP drafts but does not implement draft authoring/saving to IMAP
- local sync should mirror that current scope rather than silently expanding it

### 3.9 Settings, sync state, and user controls

Add a dedicated settings block in `src/app/(app)/messagerie/_components/parameters-client.tsx` with:

- a toggle to enable/disable local sync
- a clear explanation that IMAP remains the source of truth
- a note that the feature is optional and disabled by default
- current sync mode badge
- last successful sync time
- per-mailbox status
- bootstrap/backfill progress
- manual “sync now” action
- clear/purge local data action
- estimated storage usage

Mailbox UI should also show light-weight status when local sync is enabled:

- `Synchronisé localement`
- `Dernière sync`
- `Synchronisation en cours`
- `Données locales obsolètes`
- `Historique partiel pendant la synchronisation initiale`

### 3.10 Fallback behavior

Fallback behavior is mandatory for safe production rollout.

When local mode is enabled but local data is not usable:

- fall back to the current live IMAP strategy for that request
- do not break mailbox access
- surface a clear but non-blocking status to the user

Fallback should exist at several levels:

- entire mailbox read fallback
- per-message detail hydration fallback
- attachment fallback
- search fallback during bootstrap or degraded sync state

## 4. Risks and important considerations

### 4.1 Performance and storage tradeoffs

- Local sync removes live IMAP latency from the hot path, but it adds database growth and sync-job cost.
- Storing full HTML and full plain text for every message is much cheaper than storing all raw MIME plus all attachment binaries, but it is still significant on large mailboxes.
- Search indexes on synchronized mail content will increase storage and write cost.
- Attachment binary mirroring would make the feature much heavier and should not be the default first step.

### 4.2 Data consistency

- IMAP UID identity is mailbox-scoped and depends on UID validity.
- Folder moves create a new mailbox-local identity.
- `messageId` can be absent or duplicated and cannot be the sole deduplication key.
- Flag drift and delete/move drift must be reconciled explicitly.
- The local DB must be treated as a read model that can be rebuilt from IMAP, not as a new source of truth.

### 4.3 Duplication risks

- Duplicate prevention must be based on mailbox-scoped IMAP identity, not only `messageId`.
- Sent messages need special care because the app already knows about them before the next IMAP sync.
- Remote moves across folders can temporarily create duplicate-looking records if reconciliation is weak.

### 4.4 Stale data risks

- The current cron runs every 5 minutes, so pure cron-only sync would feel stale.
- On-demand sync hooks are needed on:
  - manual refresh
  - mailbox open when last sync is too old
  - focus/visibility return
- The UI must clearly display freshness and not pretend local data is real-time when it is not.

### 4.5 Attachment strategy

- Keeping attachments on-demand is the right default for storage and privacy.
- It still leaves one live IMAP dependency on the attachment path, which is acceptable because attachment access is less frequent than mailbox navigation.
- Inline/CID-heavy messages may need special testing because HTML rendering and attachment hydration are linked.

### 4.6 Recovery and partial sync behavior

- If credentials break, local mode should degrade safely to:
  - last known local data
  - or live IMAP fallback if possible
- UID validity resets must trigger mailbox-local rebuilds.
- Partial bootstrap must be explicit:
  - users need to know whether history is fully available or still backfilling
- Disabling local sync must not block access to the current live mailbox mode.

### 4.7 Security and privacy

- This feature materially increases the amount of email content stored in the app database.
- Access control must remain tenant/account-scoped exactly like current messaging features.
- Local sync tables must never store IMAP credentials.
- Purge behavior on disable must be reliable and auditable.
- Binary attachment caching, if ever added, should use a stricter privacy model than the base metadata/body cache.

### 4.8 Backward compatibility and preservation of current behavior

- The default live IMAP path must remain untouched for users who do not enable the feature.
- Existing routes, mailbox sections, tracking, scheduled emails, saved responses, and settings must continue to work.
- The feature must not assume custom folders, draft authoring, or a new worker deployment model that the current app does not have.

## 5. Progressive action plan

1. Create the feature foundation and persistence contract.
   Goal: add the database and service-layer foundation without changing any user-facing runtime behavior yet.
   The agent should:
   - extend `MessagingSettings` with the minimum local-sync configuration fields, starting with `localSyncEnabled` and explicit sync status support fields only if they are needed for the UX
   - add new Prisma models for:
     - mailbox sync state per account and logical mailbox
     - local message records
     - local attachment metadata records
   - define enums for local sync status and any local body-hydration state
   - ensure all new models are scoped by the same account identity already used in `src/server/messaging.ts` via `resolveUserId()`
   - add indexes for the intended read paths:
     - mailbox listing
     - message lookup by mailbox + UID
     - correlation by `messageId`
     - local search
   - create a dedicated local-sync server module rather than overloading `src/server/messaging.ts` immediately
   Deliverable: schema migration, generated Prisma client, and a new server module with typed CRUD helpers for local sync state and local mailbox records.
   Validation before moving on:
   - migrations apply cleanly
   - no existing Messagerie page or action changes behavior when `localSyncEnabled` is false
   - tests cover tenant/account scoping and uniqueness constraints

2. Build the mailbox synchronization engine for one mailbox end-to-end.
   Goal: prove the architecture with `inbox` first before generalizing to all other mailboxes.
   The agent should:
   - reuse the existing IMAP connection, mailbox discovery, mailbox opening, and message parsing logic from `src/server/messaging.ts`
   - implement a synchronization flow for `inbox` that can:
     - bootstrap a recent working set
     - persist list metadata and normalized bodies
     - store attachment metadata
     - record mailbox cursor state
   - explicitly store:
     - mailbox path
     - UID validity
     - UID
     - envelope/list data
     - normalized plain text
     - sanitized HTML when available
   - avoid storing attachment binaries and full raw MIME by default
   - design the sync logic so it can later support:
     - delta sync
     - reconciliation sync
     - mailbox rebuild on UID validity reset
   Deliverable: an `inbox` local sync service that can be called directly from server code and produces durable local mailbox data.
   Validation before moving on:
   - repeated sync runs do not create duplicates
   - the same message updates instead of duplicating when re-synced
   - a broken or partial sync leaves prior local data intact
   - sync can recover from an empty local database

3. Generalize the sync engine to all currently supported logical mailboxes.
   Goal: expand from `inbox` to the real production mailbox set already exposed by the UI.
   The agent should:
   - add support for `sent`, `drafts`, `trash`, and `spam`
   - preserve the current logical mailbox mapping already used by the product
   - persist mailbox-specific sync state independently for each logical mailbox
   - codify mailbox readiness rules so a mailbox is only considered locally readable once its bootstrap window is complete
   - add support for slower backfill and separate recent-window vs full reconciliation logic
   - decide and encode a retention/backfill policy explicitly rather than leaving it implicit
   Deliverable: one reusable mailbox sync engine that works for the five existing Messagerie sections and exposes a clear status per mailbox.
   Validation before moving on:
   - each mailbox can bootstrap independently
   - a failure in one mailbox does not block the others
   - sent-mail sync still preserves `messageId` correlation for tracking
   - sync state clearly distinguishes `BOOTSTRAPPING`, `READY`, `DEGRADED`, and `ERROR`

4. Integrate local read paths behind an explicit mode switch while preserving the current default.
   Goal: make mailbox reads use local data only when the user has opted in and the mailbox is locally usable.
   The agent should:
   - introduce a small read-mode decision layer, for example:
     - live IMAP mode when local sync is disabled
     - local-first mode when enabled and mailbox is ready
     - IMAP fallback when local mode is enabled but data is missing or degraded
   - refactor the existing read operations so the UI contract stays stable:
     - mailbox list/page fetch
     - message detail fetch
     - search
     - attachment metadata access
     - refresh behavior
   - keep the current route/page structure unchanged
   - preserve the current `MailboxClient` props contract as much as possible to reduce rollout risk
   - ensure local search matches current product scope first, which is `inbox` and `sent`
   Deliverable: the mailbox UI can transparently read from local DB when enabled, without breaking the current live path for other users.
   Validation before moving on:
   - users with local sync disabled still use the current IMAP strategy
   - users with local sync enabled get local list/detail/search reads when mailbox data is ready
   - incomplete local data falls back safely to IMAP
   - refresh still works and does not produce inconsistent mixed-mode results

5. Add mutation coherence: send, move, read state, refresh, and detail hydration.
   Goal: ensure the local read model stays coherent after user actions.
   The agent should:
   - update the send flow so locally synced users see sent items reflected immediately in local state, while preserving the current SMTP + IMAP append behavior
   - update move-message flows so:
     - IMAP move remains the real remote operation
     - local source mailbox is updated immediately
     - target mailbox is invalidated or refreshed safely
   - implement read/unread state write-back design for local mode:
     - local UI state updates immediately
     - IMAP write-back is attempted
     - failures mark local sync state as degraded and are reconciled later
   - implement lazy body hydration:
     - if local detail metadata exists but HTML/body is incomplete, fetch once from IMAP, persist, then serve
   - ensure attachment preview/download can use locally stored metadata and only fetch binary content on demand
   Deliverable: local mode behaves coherently after common actions and does not drift immediately after send/move/open.
   Validation before moving on:
   - sent mailbox rows still include tracking data
   - moved messages disappear from the source view and reappear correctly later in the target view
   - opening a message in local mode does not require a full IMAP detail fetch once it has been hydrated
   - no duplicate sent or moved messages appear in local storage

6. Connect synchronization to the real scheduling model and manual triggers.
   Goal: make the feature production-realistic within the app’s existing cron/job architecture.
   The agent should:
   - extend the existing messaging job system in `src/server/messaging-jobs.ts` with dedicated local-sync job types
   - schedule jobs only for accounts that enabled local sync
   - support at least:
     - initial bootstrap
     - periodic delta sync
     - periodic reconciliation
     - explicit mailbox re-sync
     - purge local data after disable
   - reuse the current `/api/cron/messaging` entrypoint and existing scheduler model instead of introducing a long-lived worker
   - add an on-demand manual sync path for the current mailbox from the UI
   Deliverable: local sync runs through the same production job infrastructure as the rest of Messagerie background work.
   Validation before moving on:
   - cron-triggered runs do not process users who have not enabled local sync
   - manual sync can refresh the active mailbox without waiting for the next cron slot
   - jobs are idempotent and safe to retry
   - disable/purge jobs do not break live IMAP fallback access

7. Add the settings UX, mailbox sync status UX, and safe enable/disable flow.
   Goal: expose the feature in a way that is explicit, optional, and operationally understandable to users.
   The agent should:
   - add a dedicated local-sync section to `src/app/(app)/messagerie/_components/parameters-client.tsx`
   - expose:
     - enable/disable toggle
     - explanation that IMAP remains the source of truth
     - current sync mode
     - last successful sync time
     - per-mailbox status
     - bootstrap/backfill progress
     - manual sync button
     - purge local data button
   - add mailbox-level status messaging in the main mailbox UI when local mode is enabled
   - ensure enabling does not immediately hard-switch the UI to incomplete local data before the mailbox is ready
   - ensure disabling immediately returns the UI to live mode even if purge continues in background
   Deliverable: a complete opt-in UX and operational status surface consistent with the rest of Messagerie.
   Validation before moving on:
   - default remains off for all existing users
   - enabling starts sync and shows progress
   - disabling returns the user to live mode immediately
   - users can understand whether they are seeing fully synced, partially synced, or degraded local data

8. Harden the feature for production rollout.
   Goal: make the implementation safe, testable, observable, and rollback-friendly.
   The agent should:
   - add focused tests for:
     - bootstrap sync
     - delta sync
     - reconciliation
     - UID validity reset
     - duplicate prevention
     - sent tracking linkage
     - local search behavior
     - local fallback to IMAP
     - disable/purge behavior
     - tenant/account isolation
   - add operational logging and metrics around:
     - sync duration
     - messages synced
     - hydration count
     - fallback rate
     - sync failures per mailbox
     - storage growth indicators
   - keep a hard rollout guard:
     - feature flag
     - or equivalent server-side kill switch in addition to the user setting
   - document operational recovery paths for:
     - mailbox rebuild
     - degraded sync
     - purge/reseed
   Deliverable: a production-ready local-sync feature that can be rolled out gradually and turned off safely if needed.
   Validation before launch:
   - no regression for users who never enable local sync
   - acceptable sync duration and storage growth on representative mailbox sizes
   - fallback path is verified in failure scenarios
   - all critical flows pass with local sync both on and off

## 6. Notes to preserve

- Current users, current data, and current Messagerie behavior must not break.
- This mode is optional.
- The current live IMAP strategy remains the default.
- Users who do not activate this mode should not pay new synchronization cost.
- IMAP remains the remote source of truth and synchronization layer.
- New local sync tables and jobs must use the active account/tenant identity, not the raw session user id.
