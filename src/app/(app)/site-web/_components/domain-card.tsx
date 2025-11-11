"use client";

import { useActionState, useState, useTransition } from "react";
import type { WebsiteDomainStatus } from "@prisma/client";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Button } from "@/components/ui/button";
import {
  requestCustomDomainAction,
  verifyDomainAction,
  activateDomainAction,
  disconnectDomainAction,
} from "@/app/(app)/site-web/actions";
import {
  INITIAL_DOMAIN_FORM_STATE,
  type DomainFormState,
} from "@/app/(app)/site-web/form-state";

type DomainCardProps = {
  customDomain: string | null;
  status: WebsiteDomainStatus;
  edgeDomain: string;
  verificationCode: string;
};

const STATUS_LABELS: Record<WebsiteDomainStatus, string> = {
  PENDING: "En attente",
  VERIFIED: "Vérifié",
  ACTIVE: "Actif",
};

export function DomainCard({
  customDomain,
  status,
  edgeDomain,
  verificationCode,
}: DomainCardProps) {
  const [domainState, domainAction] = useActionState<
    DomainFormState,
    FormData
  >(requestCustomDomainAction, INITIAL_DOMAIN_FORM_STATE);
  const [secondaryFeedback, setSecondaryFeedback] =
    useState<DomainFormState | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<
    "verify" | "activate" | "disconnect" | null
  >(null);

  function runSecondaryAction(
    type: "verify" | "activate" | "disconnect",
    action: () => Promise<DomainFormState>,
  ) {
    setPendingAction(type);
    startTransition(() => {
      action()
        .then((result) => setSecondaryFeedback(result))
        .catch((error) => {
          setSecondaryFeedback({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Action impossible pour le moment.",
          });
        })
        .finally(() => {
          setPendingAction((current) => (current === type ? null : current));
        });
    });
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Domaine personnalisé
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Pointez votre domaine vers <strong>{edgeDomain}</strong> via un
          CNAME, ajoutez l’enregistrement TXT ci-dessous puis validez.
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="label">Statut:</span>
        <span
          className="badge bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {STATUS_LABELS[status]}
        </span>
      </div>
      {(domainState.message || secondaryFeedback?.message) && (
        <Alert
          variant={
            (domainState.status === "error" ||
              secondaryFeedback?.status === "error")
              ? "error"
              : "success"
          }
          title={
            domainState.message ?? secondaryFeedback?.message ?? undefined
          }
        />
      )}
      <form action={domainAction} className="space-y-3">
        <div>
          <label htmlFor="customDomain" className="label">
            Domaine
          </label>
          <Input
            id="customDomain"
            name="customDomain"
            placeholder="www.mondomaine.com"
            defaultValue={customDomain ?? ""}
          />
        </div>
        <FormSubmitButton>Enregistrer le domaine</FormSubmitButton>
      </form>
      <div className="rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900/70">
        <p className="font-medium text-zinc-900 dark:text-white">
          Enregistrement TXT de vérification
        </p>
        <div className="mt-2 rounded border border-dashed border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900">
          verification={verificationCode}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !customDomain}
          loading={pending && pendingAction === "verify"}
          onClick={() => runSecondaryAction("verify", verifyDomainAction)}
        >
          Vérifier
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={pending || status !== "VERIFIED"}
          loading={pending && pendingAction === "activate"}
          onClick={() => runSecondaryAction("activate", activateDomainAction)}
        >
          Activer
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending || !customDomain}
          loading={pending && pendingAction === "disconnect"}
          onClick={() => runSecondaryAction("disconnect", disconnectDomainAction)}
        >
          Déconnecter
        </Button>
      </div>
    </div>
  );
}
