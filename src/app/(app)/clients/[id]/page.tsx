import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { AccountPermission } from "@prisma/client";
import { getClient } from "@/server/clients";
import {
  getClientPaymentPeriodSummary,
  listClientPaymentsPage,
} from "@/server/client-payments";
import {
  canAccessAppSection,
  hasAccountPermission,
  requireAppSectionAccess,
} from "@/lib/authorization";
import {
  readClientPaymentSearchParam,
} from "@/lib/client-payment-filters";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { PrefetchLink } from "@/components/ui/prefetch-link";

type SearchParams = Record<string, string | string[] | undefined>;
const CLIENT_PAYMENT_PREVIEW_LIMIT = 10;

function buildSectionRedirectHref(
  pathname: string,
  searchParams: SearchParams,
  extraParams: Record<string, string | null | undefined> = {},
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (
      key === "workspace" ||
      value === undefined ||
      Object.prototype.hasOwnProperty.call(extraParams, key)
    ) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      return;
    }

    params.set(key, value);
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });
  const query = params.toString();
  return (query ? `${pathname}?${query}` : pathname) as Route;
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireAppSectionAccess("clients", {
    redirectOnFailure: true,
  });
  const { id } = await params;
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const client = await getClient(id, tenantId);

  if (!client) {
    notFound();
  }

  const requestedWorkspace =
    readClientPaymentSearchParam(resolvedSearchParams, "workspace");
  if (requestedWorkspace === "services") {
    redirect(
      buildSectionRedirectHref("/services", resolvedSearchParams, {
        client: null,
      }),
    );
  }
  if (requestedWorkspace === "payments") {
    redirect(
      buildSectionRedirectHref("/paiements", resolvedSearchParams, {
        client: client.id,
      }),
    );
  }

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

  const [paymentSummary, recentPaymentsPage] = await Promise.all([
    getClientPaymentPeriodSummary(
      {
        clientId: client.id,
        includeByClient: false,
      },
      tenantId,
    ),
    listClientPaymentsPage(
      {
        clientId: client.id,
        page: 1,
        pageSize: CLIENT_PAYMENT_PREVIEW_LIMIT,
      },
      tenantId,
    ),
  ]);

  const canManageClients = hasAccountPermission(
    user,
    AccountPermission.CLIENTS_MANAGE,
  );
  const canOpenServicesSection = canAccessAppSection(user, "services");
  const canOpenPaymentsSection = canAccessAppSection(user, "payments");
  const canOpenCollaboratorsSection = canAccessAppSection(
    user,
    "collaborators",
  );

  const receiptCount = paymentSummary.totals.receiptCount;
  const latestPayment = recentPaymentsPage.items[0] ?? null;

  return (
    <div className="space-y-8">
      <FlashMessages messages={flashMessages} />

      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <PrefetchLink
            href="/clients"
            className="inline-flex text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Retour aux clients
          </PrefetchLink>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {client.displayName}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {client.companyName ?? "Dossier client"} ·{" "}
              {client.email ?? "Sans e-mail"} · {client.phone ?? "Sans téléphone"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={client.isActive ? "success" : "neutral"}>
              {client.isActive ? "Actif" : "Inactif"}
            </Badge>
            {client.vatNumber ? <Badge variant="info">{client.vatNumber}</Badge> : null}
            <Badge variant="neutral">
              {paymentSummary.totals.paymentCount} paiement
              {paymentSummary.totals.paymentCount > 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          {canManageClients ? (
            <Button asChild variant="secondary">
              <PrefetchLink href={`/clients/${client.id}/modifier` as Route}>
                Modifier le client
              </PrefetchLink>
            </Button>
          ) : null}
          {canOpenPaymentsSection ? (
            <Button asChild variant="ghost">
              <PrefetchLink href={`/paiements?client=${client.id}` as Route}>
                Paiements du client
              </PrefetchLink>
            </Button>
          ) : null}
          {canOpenCollaboratorsSection ? (
            <Button asChild variant="ghost">
              <PrefetchLink href="/collaborateurs">Collaborateurs</PrefetchLink>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Total encaissé
          </p>
          <div className="mt-2 space-y-1">
            {paymentSummary.totals.totalsByCurrency.length ? (
              paymentSummary.totals.totalsByCurrency.map((totals) => (
                <p
                  key={totals.currency}
                  className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  {formatCurrency(
                    fromCents(totals.totalAmountCents, totals.currency),
                    totals.currency,
                  )}
                </p>
              ))
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Aucun paiement enregistré
              </p>
            )}
          </div>
          {paymentSummary.totals.totalsByCurrency.length > 1 ? (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Totaux séparés par devise.
            </p>
          ) : null}
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Reçus générés
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {receiptCount}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Dernier paiement
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {latestPayment ? formatDate(latestPayment.date) : "Aucun"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="card space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Profil client
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Coordonnées de référence et notes internes.
            </p>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Adresse</dt>
              <dd className="mt-1 whitespace-pre-line text-zinc-900 dark:text-zinc-100">
                {client.address ?? "Non renseignée"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">E-mail</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {client.email ?? "Non renseigné"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Téléphone</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {client.phone ?? "Non renseigné"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">
                Dernière mise à jour
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {formatDate(client.updatedAt)}
              </dd>
            </div>
          </dl>

          {canManageClients ? (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Notes internes
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                {client.notes ?? "Aucune note interne."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="card space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Suivi paiements
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Ce dossier reste centre sur l&apos;information client et son
              historique de paiements. La creation des paiements se fait dans la
              section Paiements, et les services se gerent depuis le catalogue
              global.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {canOpenPaymentsSection ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Paiements
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  Ouvrez la liste globale des paiements avec ce client deja
                  filtre pour consulter tout son historique.
                </p>
                <div className="mt-4">
                  <Button asChild variant="secondary">
                    <PrefetchLink href={`/paiements?client=${client.id}` as Route}>
                      Ouvrir la section
                    </PrefetchLink>
                  </Button>
                </div>
              </div>
            ) : null}

            {canOpenServicesSection ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Services
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  Le catalogue des services est maintenant commun a tout le
                  compte, sans rattachement a un client unique.
                </p>
                <div className="mt-4">
                  <Button asChild variant="secondary">
                    <PrefetchLink href="/services">Ouvrir le catalogue</PrefetchLink>
                  </Button>
                </div>
              </div>
            ) : null}

            {canOpenCollaboratorsSection ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Collaborateurs du compte
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  Gérez les invitations et permissions du compte depuis un espace
                  séparé.
                </p>
                <div className="mt-4">
                  <Button asChild variant="secondary">
                    <PrefetchLink href="/collaborateurs">Ouvrir la section</PrefetchLink>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Historique des paiements
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Vue contextuelle des paiements depuis le dossier client.
            </p>
          </div>
          {canOpenPaymentsSection ? (
            <Button asChild variant="secondary">
              <PrefetchLink href={`/paiements?client=${client.id}` as Route}>
                Gérer dans Paiements
              </PrefetchLink>
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          {paymentSummary.totals.paymentCount > recentPaymentsPage.items.length ? (
            <Alert
              variant="warning"
              title="Historique recent limité"
              description={`Les ${recentPaymentsPage.items.length} paiements les plus récents sont affichés ici pour garder le dossier rapide. Ouvrez la section Paiements pour consulter tout l'historique.`}
            />
          ) : null}

          {recentPaymentsPage.items.length ? (
            recentPaymentsPage.items.map((payment) => (
              <div
                key={payment.id}
                className="rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(
                        fromCents(payment.amountCents, payment.currency),
                        payment.currency,
                      )}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {payment.description ?? payment.method ?? "Paiement client"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral">{formatDate(payment.date)}</Badge>
                    {payment.receiptNumber ? (
                      <Badge variant="success">{payment.receiptNumber}</Badge>
                    ) : (
                      <Badge variant="info">Reçu à générer</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  {payment.reference ? <p>Référence : {payment.reference}</p> : null}
                  {payment.note ? (
                    <p className="whitespace-pre-line">Note : {payment.note}</p>
                  ) : null}
                  {payment.serviceLinks.length ? (
                    <div className="flex flex-wrap gap-2">
                      {payment.serviceLinks.map((link) => (
                        <Badge key={link.id} variant="info">
                          {link.titleSnapshot}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <Alert
              variant="warning"
              title="Aucun paiement"
              description="Aucun paiement n’est encore enregistré pour ce client."
            />
          )}
        </div>
      </section>
    </div>
  );
}
