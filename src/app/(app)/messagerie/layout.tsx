import type { ReactNode } from "react";
import Link from "next/link";
import { MailPlus } from "lucide-react";
import { requireAppSectionAccess } from "@/lib/authorization";
import { getMessagingSettingsSummary } from "@/server/messaging";
import { MailboxSyncProvider } from "@/app/(app)/messagerie/_components/mailbox-sync-provider";

const composeSafeAreaPadding = "calc(env(safe-area-inset-bottom) + 1.5rem)";

export default async function MessagerieLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAppSectionAccess("messaging", {
    redirectOnFailure: true,
  });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const summary = await getMessagingSettingsSummary(tenantId);

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <MailboxSyncProvider
        enabled={summary.imapConfigured}
        userId={tenantId}
      />
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-end pr-4 pb-6 sm:pr-6 md:pr-8"
        style={{ paddingBottom: composeSafeAreaPadding }}
      >
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <Link
            href="/messagerie/nouveau-message"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 transition hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-blue-300"
            aria-label="Composer un nouveau message"
          >
            <MailPlus className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
