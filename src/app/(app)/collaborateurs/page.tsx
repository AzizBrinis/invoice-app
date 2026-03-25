import { listAccountCollaborators, listPendingAccountInvitations } from "@/server/accounts";
import { requireAppSectionAccess } from "@/lib/authorization";
import { readClientPaymentSearchParam } from "@/lib/client-payment-filters";
import { CollaboratorsShell } from "@/app/(app)/collaborateurs/_components/collaborators-shell";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CollaborateursPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireAppSectionAccess("collaborators", {
    redirectOnFailure: true,
  });
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const [collaborators, pendingInvitations] = await Promise.all([
    listAccountCollaborators(tenantId, user.id),
    listPendingAccountInvitations(tenantId, user.id),
  ]);
  const successMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "message") ?? null;
  const warningMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "warning") ?? null;
  const errorMessage =
    readClientPaymentSearchParam(resolvedSearchParams, "error") ?? null;

  const flashMessages: FlashMessage[] = [];
  if (successMessage) {
    flashMessages.push({ variant: "success", title: successMessage });
  }
  if (warningMessage) {
    flashMessages.push({ variant: "warning", title: warningMessage });
  }
  if (errorMessage) {
    flashMessages.push({ variant: "error", title: errorMessage });
  }

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Collaborateurs du compte
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Invitez des personnes à collaborer sur ce compte et gérez leurs
          permissions depuis un espace dédié.
        </p>
      </div>

      <CollaboratorsShell
        collaborators={collaborators}
        pendingInvitations={pendingInvitations}
      />
    </div>
  );
}
