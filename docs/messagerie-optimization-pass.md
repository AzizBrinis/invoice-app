# Messagerie Optimization Pass

## Scope

This document records the Messagerie performance/stability pass, including:

- the confirmed bottlenecks found in the current implementation
- the changes that were kept
- the changes that were tried and then reverted/corrected
- the final current state after the sent-folder fixes
- verification status and remaining follow-up items

## Initial Problems Observed

- Folder navigation in Messagerie felt slow and heavy.
- Opening a message could trigger extra work and noticeable delay.
- The messaging cache did not feel reliable across visits.
- The sent mailbox could resolve slowly and inconsistently.
- Background messaging logic was mounted too broadly in the app.
- Some mailbox/attachment behavior was correct only for part of the feature set.

## Confirmed Root Causes

- The mailbox store could overwrite persisted session cache when switching/priming the active cache user.
- Mailbox state persistence wrote large mailbox payloads to `sessionStorage` synchronously on every update.
- The mailbox client eagerly warmed message details beyond clear user intent, which increased parsing/fetch pressure.
- Messaging synchronization was mounted from the shared app layout instead of being scoped to the Messagerie area.
- IMAP mailbox-path caching was global by mailbox type, not by account/connection.
- Messaging account resolution could fall back to the session user id instead of the active tenant/account id.
- The IMAP mailbox-open path was doing redundant work by acquiring a mailbox lock and then opening the same mailbox again before every fetch/detail/update/attachment/move flow.
- Mailbox requests also sent explicit `mailboxClose()` commands immediately before IMAP logout, adding another avoidable round-trip on short-lived requests.
- Message-detail caching still triggered debounced mailbox persistence even though detail payloads are intentionally not stored in `sessionStorage`.
- Hydrated session cache could override fresher server-rendered page-1 mailbox data after navigation, causing stale lists to briefly come back until a later refresh.
- Page-1 snapshot refreshes could discard already loaded older pages in the client cache.
- Mailbox-row selection state was passed in a way that caused broad list rerenders during every selection/detail-loading transition.
- Background sync replaced full mailbox lists even when only `totalMessages` metadata changed.
- Switching the active mailbox cache user still deleted the previous keyed session cache, which reduced cache reliability across account or tenant switches.
- Sent-folder lookup used fragile candidate logic and, during the pass, an intermediate variant-expansion change generated invalid IMAP names.
- A client-only mailbox-loading experiment made navigation feel slower in practice and was reverted.
- A desktop mailbox-list virtualization experiment caused layout/design regressions and was reverted.

## Final Changes Kept

### 1. Layout and Feature Scoping

- `MailboxSyncProvider` was moved out of `src/app/(app)/layout.tsx`.
- `MailboxSyncProvider` now mounts in `src/app/(app)/messagerie/layout.tsx`.
- Result:
  non-Messagerie pages no longer pay messaging sync/setup cost.

### 2. Mailbox Store Fixes

File:
`src/app/(app)/messagerie/_state/mailbox-store.ts`

- Fixed `setMailboxCacheUser()` so it no longer wipes persisted cache by resetting state and immediately persisting an empty payload.
- Cache hydration now restores the existing persisted mailbox snapshot before listeners are notified.
- Added debounced persistence for mailbox state updates instead of synchronous `sessionStorage` writes on every store mutation.
- Removed the obsolete mailbox `active` flag path from the store after sync scope was changed.
- Bumped the session-storage cache namespace from `mailbox-cache-v2` to `mailbox-cache-v3` so stale/wrong mailbox data does not survive after the sent-folder corrections.

### 3. Mailbox Client Behavior

File:
`src/app/(app)/messagerie/_components/mailbox-client.tsx`

- Kept the mailbox row extraction/memoized rendering cleanup.
- Removed eager automatic detail warming for:
  initial top rows
  rows entering the viewport
- Kept only user-intent detail warming paths:
  hover
  focus
  explicit selection
- Preserved the stable existing list rendering path after the virtualization attempt caused UI/design regressions.

### 4. Background Sync Behavior

File:
`src/app/(app)/messagerie/_components/mailbox-sync-provider.tsx`

- Background sync is now scoped to:
  `inbox`
  the currently viewed mailbox route
- This replaced the older “once visited, always active” behavior.
- Background network failures in background sync no longer raise noisy toast errors.
- User-facing errors are still preserved on direct user-triggered actions in the mailbox client.

### 5. IMAP Account and Mailbox Resolution Fixes

File:
`src/server/messaging.ts`

- `resolveUserId()` now uses the active tenant/account context:
  `activeTenantId ?? tenantId ?? id`
- Added request-scoped reuse of messaging settings records to reduce duplicate reads within a request.
- IMAP mailbox-path cache is now scoped by connection/account instead of a global mailbox-only key.
- Mailbox cache keys are versioned so stale cached mailbox-path choices do not survive corrective changes.
- Removed the broken mailbox variant expansion that was producing invalid attempts such as transformed `INBOX...` Gmail paths.
- Expected mailbox candidate misses are now treated as normal fallback behavior instead of noisy warnings.

### 6. Sent Mailbox Correction

File:
`src/server/messaging.ts`

Final strategy for non-inbox mailbox opening:

- If there is a validated cached path for the mailbox, try that first.
- If there is no validated cached path, discover real folders first via IMAP listing and rank candidates from actual server folders before falling back.
- Keep static candidates as fallback support, not as the first uncached sent-folder strategy.

Why this was necessary:

- The intermediate “static guesses first” path could pick the wrong sent mailbox when multiple sent-like folders existed.
- That could make only a subset of sent emails appear.
- It also increased latency because many invalid candidates were tried before the correct folder was found.

### 7. Attachment Route Correction

File:
`src/app/api/messagerie/attachments/[mailbox]/[uid]/[attachmentId]/route.ts`

- Attachment downloads/previews are now allowed for all supported messaging folders:
  `inbox`
  `sent`
  `drafts`
  `trash`
  `spam`

### 8. IMAP Mailbox Open Simplification

File:
`src/server/messaging.ts`

- `openMailbox()` now uses `getMailboxLock(name, { readOnly })` as the mailbox-open primitive instead of locking and then reopening the same mailbox.
- Removed explicit `mailboxClose()` calls before logout across mailbox fetch/detail/update/attachment/move/test flows.
- Result:
  fewer IMAP round-trips on every mailbox operation and faster folder/message interactions.

### 9. Store Persistence and Snapshot Reconciliation

File:
`src/app/(app)/messagerie/_state/mailbox-store.ts`

- `cacheMessageDetail()` no longer schedules mailbox persistence writes.
- `replaceMailboxMessages()` now preserves already loaded older pages when a fresh page-1 snapshot arrives and trims overflow when the total count is known.
- Store updates now reuse the existing message array when mailbox content is unchanged, avoiding rerenders for metadata-only state changes.

### 10. Mailbox Client Freshness and Row Rendering

File:
`src/app/(app)/messagerie/_components/mailbox-client.tsx`

- Fresh server-provided `initialPage` data is now reconciled against hydrated client state instead of being ignored when stale cache already exists.
- Mailbox rows now receive row-local active/loading flags and are memoized so selection/detail-loading transitions only rerender impacted rows.
- Date formatting now reuses a shared formatter instead of allocating a formatter during each row render.

### 11. Background Sync Metadata Optimization

File:
`src/app/(app)/messagerie/_components/mailbox-sync-provider.tsx`

- Metadata-only sync results now update mailbox metadata instead of replacing the entire list.
- Priming a new mailbox cache user no longer deletes the previous keyed session cache entry.

## Changes Tried And Then Reverted / Corrected

These changes were attempted during the pass but were not kept in the final state.

### A. Client-Only Initial Mailbox Loading

Files involved:

- mailbox pages under `src/app/(app)/messagerie/*/page.tsx`
- `src/app/(app)/messagerie/load-initial-mailbox-data.ts`

What was tried:

- Removing the server-side initial mailbox preload and letting the mailbox load only from the client/store path.

Why it was reverted:

- In practice, the user experience became slower.
- Navigation ended up rendering the page shell and then triggering a slower follow-up mailbox load path.
- The result was a degraded perceived experience, especially in the sent mailbox path.

Final state:

- The stable server-side initial mailbox preload path was restored.

### B. Desktop Mailbox List Virtualization

File involved:

- `src/app/(app)/messagerie/_components/mailbox-client.tsx`

What was tried:

- Virtualizing the desktop mailbox list.

Why it was reverted:

- It introduced design/layout breakage.
- The regression cost was higher than the benefit in the current UI/context.

Final state:

- The original full-list rendering path was restored.
- The safer performance change kept was removal of wasteful automatic detail prefetching.

### C. IMAP Mailbox Variant Expansion

File involved:

- `src/server/messaging.ts`

What was tried:

- Expanding mailbox paths into slash/dot segment variants before opening them.

Why it was corrected:

- It generated invalid IMAP mailbox names for real server folders, especially Gmail-style sent folders.
- It produced errors/noise and increased latency.

Final state:

- Only real mailbox paths are attempted.
- Candidate fallback is driven by cache + discovery + ranked candidates, not fabricated path variants.

## Files Updated

- `src/app/(app)/layout.tsx`
  removed global Messagerie sync mounting from shared app layout
- `src/app/(app)/messagerie/layout.tsx`
  mounted Messagerie-only sync provider
- `src/app/(app)/messagerie/load-initial-mailbox-data.ts`
  retained/restored server-side initial mailbox preload helper
- `src/app/(app)/messagerie/_state/mailbox-store.ts`
  fixed cache priming, added debounced persistence, bumped cache namespace
- `src/app/(app)/messagerie/_components/mailbox-sync-provider.tsx`
  narrowed sync scope and reduced background error noise
- `src/app/(app)/messagerie/_components/mailbox-client.tsx`
  removed wasteful automatic detail warming, preserved stable list rendering, reconciled fresh server snapshots with hydrated cache, and reduced row rerender churn
- `src/server/messaging.ts`
  fixed tenant/account resolution, request-scoped settings reuse, connection-scoped mailbox-path cache, sent-folder lookup behavior, warning noise, mailbox opening corrections, and removed redundant IMAP open/close round-trips
- `src/app/api/messagerie/attachments/[mailbox]/[uid]/[attachmentId]/route.ts`
  expanded mailbox support for attachments
- `tests/mailbox-store.test.ts`
  added regression coverage for page-1 snapshot reconciliation and detail-cache persistence behavior

## Final Expected Impact

- Session cache should now survive correctly instead of being unintentionally reset.
- Returning to previously visited mailboxes should benefit from the restored cache behavior.
- Returning to a previously visited mailbox after a fresh server render should no longer snap back to an older hydrated snapshot.
- Opening messages should trigger fewer unnecessary detail fetches/parses.
- Opening folders/messages/attachments should spend fewer IMAP round-trips on mailbox open/close work.
- Non-Messagerie app pages should no longer pay messaging sync overhead.
- Sent-folder resolution should be more accurate on accounts with multiple sent-like folders.
- IMAP folder opening should produce less warning noise and fewer bad candidate attempts.
- Background sync should no longer trigger full-list rerenders when only message counts change.
- Refreshing page 1 should no longer discard already loaded older pages from the in-memory mailbox cache.
- Selecting a message should now rerender only the affected mailbox rows instead of the whole visible list.
- The UI should remain on the stable non-virtualized design path while still removing some avoidable heavy work.

## Verification

- Targeted `eslint` passes on the edited Messagerie/layout/server files.
- Targeted `eslint` passes on:
  `src/server/messaging.ts`
  `src/app/(app)/messagerie/_state/mailbox-store.ts`
  `src/app/(app)/messagerie/_components/mailbox-sync-provider.tsx`
  `src/app/(app)/messagerie/_components/mailbox-client.tsx`
  `tests/mailbox-store.test.ts`
- `npm test -- tests/mailbox-store.test.ts tests/assistant-email-scheduling.test.ts` passed.
- `npm test -- tests/assistant-email-scheduling.test.ts` passed.
- `npm test -- tests/messaging-attachments.test.ts tests/messaging-jobs.test.ts tests/assistant-email-scheduling.test.ts` could not fully run because `TEST_DATABASE_URL` is not defined in the current environment.
- `npx tsc --noEmit --pretty false` reports unrelated pre-existing failures outside Messagerie, so it was not a reliable validation signal for this pass.

## Remaining Follow-Up If Sent Mailbox Is Still Wrong Or Slow

- Log the exact IMAP folder path selected for `sent` on the live account.
- Compare that selected folder with the expected provider folder on the real mailbox.
- Measure live timing for:
  IMAP connect
  folder open
  page-1 fetch
  tracking summary enrichment
- If mailbox latency is still the dominant cost after this pass, the next architectural step is controlled IMAP connection reuse/pooling. This was not introduced in the current pass to keep the result pragmatic and low-risk.
- If needed, persist a validated resolved mailbox path per account/settings record instead of relying only on in-memory cache.
