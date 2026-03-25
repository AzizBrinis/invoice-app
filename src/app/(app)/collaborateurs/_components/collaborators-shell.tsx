"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { AccountMembershipRole, AccountPermission } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { formatDate } from "@/lib/formatters";
import {
  createClientPaymentsInvitationInlineAction,
  type SerializedPendingInvitation,
} from "@/app/(app)/collaborateurs/actions";
import {
  listAccountCollaborators,
  listPendingAccountInvitations,
} from "@/server/accounts";

const COLLABORATOR_PERMISSION_OPTIONS: Array<{
  value: AccountPermission;
  label: string;
}> = [
  { value: AccountPermission.DASHBOARD_VIEW, label: "Voir le tableau de bord" },
  { value: AccountPermission.CLIENTS_VIEW, label: "Voir les clients" },
  { value: AccountPermission.CLIENTS_MANAGE, label: "Gérer les clients" },
  { value: AccountPermission.SERVICES_MANAGE, label: "Gérer les services" },
  { value: AccountPermission.PAYMENTS_MANAGE, label: "Gérer les paiements" },
  { value: AccountPermission.RECEIPTS_MANAGE, label: "Gérer les reçus" },
  { value: AccountPermission.REPORTS_VIEW, label: "Voir les rapports" },
  {
    value: AccountPermission.COLLABORATORS_MANAGE,
    label: "Gérer les collaborateurs",
  },
];

type CollaboratorsShellProps = {
  collaborators: Awaited<ReturnType<typeof listAccountCollaborators>>;
  pendingInvitations: Awaited<ReturnType<typeof listPendingAccountInvitations>>;
};

type PendingInvitationItem = {
  invitationId: string;
  email: string;
  role: AccountMembershipRole;
  permissions: AccountPermission[];
  invitedByName: string | null;
  invitedByEmail: string;
  expiresAt: string;
};

function normalizeInvitation(
  invitation:
    | CollaboratorsShellProps["pendingInvitations"][number]
    | SerializedPendingInvitation,
): PendingInvitationItem {
  return {
    invitationId: invitation.invitationId,
    email: invitation.email,
    role: invitation.role,
    permissions: invitation.permissions,
    invitedByName: invitation.invitedByName ?? null,
    invitedByEmail: invitation.invitedByEmail,
    expiresAt:
      typeof invitation.expiresAt === "string"
        ? invitation.expiresAt
        : invitation.expiresAt.toISOString(),
  };
}

export function CollaboratorsShell({
  collaborators,
  pendingInvitations,
}: CollaboratorsShellProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();
  const initialPendingInvitations = useMemo(
    () => pendingInvitations.map(normalizeInvitation),
    [pendingInvitations],
  );
  const [invitationState, setInvitationState] = useState(initialPendingInvitations);
  const [optimisticInvitations, addOptimisticInvitation] = useOptimistic(
    invitationState,
    (currentState, nextInvitation: PendingInvitationItem) => [
      nextInvitation,
      ...currentState,
    ],
  );
  const [createPending, setCreatePending] = useState(false);

  useEffect(() => {
    setInvitationState(initialPendingInvitations);
  }, [initialPendingInvitations]);

  function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || createPending) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const permissions = formData
      .getAll("permissions")
      .map((entry) => entry.toString())
      .filter(
        (entry): entry is AccountPermission =>
          Object.values(AccountPermission).includes(entry as AccountPermission),
      );
    const optimisticInvitation = normalizeInvitation({
      invitationId: `temp-invitation-${Date.now()}`,
      email: formData.get("email")?.toString().trim() ?? "",
      role:
        formData.get("role")?.toString() === AccountMembershipRole.ADMIN
          ? AccountMembershipRole.ADMIN
          : AccountMembershipRole.MEMBER,
      permissions,
      invitedByName: "Vous",
      invitedByEmail: "Vous",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });

    setCreatePending(true);

    startTransition(async () => {
      addOptimisticInvitation(optimisticInvitation);
      try {
        const result = await createClientPaymentsInvitationInlineAction(formData);
        const invitation = result.data?.invitation;
        if (result.status !== "success" || !invitation) {
          setInvitationState((current) => [...current]);
          addToast({
            variant: "error",
            title: result.message,
          });
          return;
        }

        setInvitationState((current) => [
          normalizeInvitation(invitation),
          ...current,
        ]);
        addToast({
          variant: "success",
          title: result.message,
        });
        form.reset();
        router.refresh();
      } catch (error) {
        setInvitationState((current) => [...current]);
        addToast({
          variant: "error",
          title:
            error instanceof Error
              ? error.message
              : "Impossible d'envoyer l'invitation.",
        });
      } finally {
        setCreatePending(false);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <form onSubmit={handleInviteSubmit} className="card space-y-4 p-5">
        <input type="hidden" name="redirectTo" value="/collaborateurs" />
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Inviter un collaborateur
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Les permissions restent limitées au compte paiements clients.
          </p>
        </div>

        <div className="space-y-1">
          <label className="label" htmlFor="collab-email">
            E-mail
          </label>
          <Input
            id="collab-email"
            name="email"
            type="email"
            required
            disabled={createPending}
          />
        </div>

        <div className="space-y-1">
          <label className="label" htmlFor="collab-role">
            Rôle
          </label>
          <select
            id="collab-role"
            name="role"
            className="input"
            defaultValue={AccountMembershipRole.MEMBER}
            disabled={createPending}
          >
            <option value={AccountMembershipRole.MEMBER}>Membre</option>
            <option value={AccountMembershipRole.ADMIN}>Admin</option>
          </select>
        </div>

        <div className="space-y-2">
          <p className="label">Permissions</p>
          <div className="space-y-2">
            {COLLABORATOR_PERMISSION_OPTIONS.map((permission) => (
              <label
                key={permission.value}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission.value}
                  defaultChecked={
                    permission.value === AccountPermission.DASHBOARD_VIEW ||
                    permission.value === AccountPermission.CLIENTS_VIEW ||
                    permission.value === AccountPermission.REPORTS_VIEW
                  }
                  disabled={createPending}
                />
                <span>{permission.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {createPending ? (
            <span className="text-xs text-blue-600 dark:text-blue-300">
              Envoi en cours...
            </span>
          ) : null}
          <Button type="submit" loading={createPending}>
            Envoyer l invitation
          </Button>
        </div>
      </form>

      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Collaborateurs actuels
          </h2>
          <div className="space-y-3">
            {collaborators.map((collaborator) => (
              <div
                key={collaborator.membershipId}
                className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {collaborator.name ?? collaborator.email}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {collaborator.email}
                    </p>
                  </div>
                  <Badge variant="neutral">{collaborator.role}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {collaborator.permissions.map((permission) => (
                    <Badge key={permission} variant="info">
                      {permission}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Invitations en attente
          </h2>
          <div className="space-y-3">
            {optimisticInvitations.length ? (
              optimisticInvitations.map((invitation) => (
                <div
                  key={invitation.invitationId}
                  className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {invitation.email}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Invitée par {invitation.invitedByName ?? invitation.invitedByEmail}
                      </p>
                    </div>
                    <Badge variant="warning">
                      Expire le {formatDate(invitation.expiresAt)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {invitation.permissions.map((permission) => (
                      <Badge key={permission} variant="info">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Aucune invitation en attente.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
