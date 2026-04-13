"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { useToast } from "@/components/ui/toast-provider";
import {
  buildClientPaymentHref,
  type ClientPaymentFilters,
} from "@/lib/client-payment-filters";
import {
  buildOptimisticClientPaymentId,
  isPersistedClientPayment,
  matchesPaymentFilters,
  reduceOptimisticPaymentsState,
  type PaymentsOptimisticAction,
  type PaymentsWorkspaceState,
} from "@/lib/client-payment-optimistic";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { fromCents, parseMinorUnitInput } from "@/lib/money";
import type {
  ClientPickerOption,
  PaymentServicePickerOption,
} from "@/lib/client-payment-picker-types";
import {
  createClientPaymentInlineAction,
  type SerializedClientPayment,
} from "@/app/(app)/paiements/actions";
import type { getClient } from "@/server/clients";
import type {
  getClientPaymentPeriodSummary,
  listClientPaymentsPage,
} from "@/server/client-payments";
import {
  AsyncClientPicker,
  PaymentServiceMultiPicker,
} from "@/app/(app)/paiements/_components/async-payment-pickers";
import { ReceiptPdfButton } from "@/app/(app)/paiements/_components/receipt-pdf-button";

type PaymentsWorkspaceShellProps = {
  canManagePayments: boolean;
  canManageReceipts: boolean;
  currency: string;
  currentPage: number;
  filters: ClientPaymentFilters;
  hasAnyClients: boolean;
  paymentMethodOptions: string[];
  selectedClient: Awaited<ReturnType<typeof getClient>> | null;
  selectedClientPickerOption: ClientPickerOption | null;
  summary: Awaited<ReturnType<typeof getClientPaymentPeriodSummary>>;
  paymentsPage: Awaited<ReturnType<typeof listClientPaymentsPage>>;
};

function formatDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizePayment(
  payment: Awaited<ReturnType<typeof listClientPaymentsPage>>["items"][number] | SerializedClientPayment,
): SerializedClientPayment {
  return {
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    date: typeof payment.date === "string" ? payment.date : payment.date.toISOString(),
    createdAt:
      typeof payment.createdAt === "string"
        ? payment.createdAt
        : payment.createdAt.toISOString(),
    method: payment.method ?? null,
    reference: payment.reference ?? null,
    description: payment.description ?? null,
    note: payment.note ?? null,
    privateNote: payment.privateNote ?? null,
    receiptNumber: payment.receiptNumber ?? null,
    receiptIssuedAt:
      typeof payment.receiptIssuedAt === "string"
        ? payment.receiptIssuedAt
        : payment.receiptIssuedAt?.toISOString() ?? null,
    receiptSentAt:
      typeof payment.receiptSentAt === "string"
        ? payment.receiptSentAt
        : payment.receiptSentAt?.toISOString() ?? null,
    client: {
      id: payment.client.id,
      displayName: payment.client.displayName,
      companyName: payment.client.companyName ?? null,
      email: payment.client.email ?? null,
    },
    serviceLinks: payment.serviceLinks.map((link) => ({
      id: link.id,
      clientServiceId: link.clientServiceId ?? null,
      titleSnapshot: link.titleSnapshot,
      detailsSnapshot: link.detailsSnapshot ?? null,
      allocatedAmountCents: link.allocatedAmountCents ?? null,
      position: link.position,
    })),
  };
}

function createInitialState(
  props: PaymentsWorkspaceShellProps,
): PaymentsWorkspaceState {
  return {
    summary: props.summary.totals,
    paymentsPage: {
      items: props.paymentsPage.items.map(normalizePayment),
      total: props.paymentsPage.total,
      page: props.paymentsPage.page,
      pageSize: props.paymentsPage.pageSize,
      pageCount: props.paymentsPage.pageCount,
    },
  };
}

function buildOptimisticPayment(
  formData: FormData,
  selectedClient: ClientPickerOption | null,
  selectedServices: PaymentServicePickerOption[],
  currency: string,
): SerializedClientPayment {
  const clientId = formData.get("clientId")?.toString() ?? "";

  return {
    id: buildOptimisticClientPaymentId(),
    amountCents: parseMinorUnitInput(formData.get("amount"), currency),
    currency,
    date: new Date(formData.get("date")?.toString() ?? new Date().toISOString()).toISOString(),
    createdAt: new Date().toISOString(),
    method: formData.get("method")?.toString().trim() || null,
    reference: formData.get("reference")?.toString().trim() || null,
    description: formData.get("description")?.toString().trim() || null,
    note: formData.get("note")?.toString().trim() || null,
    privateNote: formData.get("privateNote")?.toString().trim() || null,
    receiptNumber: null,
    receiptIssuedAt: null,
    receiptSentAt: null,
    client: {
      id: clientId,
      displayName: selectedClient?.displayName ?? "Client",
      companyName: selectedClient?.companyName ?? null,
      email: selectedClient?.email ?? null,
    },
    serviceLinks: selectedServices.map((service, index) => ({
      id: `temp-link-${service.id}-${index}`,
      clientServiceId: service.id,
      titleSnapshot: service.title,
      detailsSnapshot: service.details ?? null,
      allocatedAmountCents:
        selectedServices.length === 1
          ? parseMinorUnitInput(formData.get("amount"), currency)
          : null,
      position: index,
    })),
  };
}

function PendingActionContent({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function PaymentsWorkspaceShell(props: PaymentsWorkspaceShellProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();
  const initialState = useMemo(() => createInitialState(props), [props]);
  const [workspaceState, setWorkspaceState] =
    useState<PaymentsWorkspaceState>(initialState);
  const [optimisticState, applyOptimisticUpdate] = useOptimistic<
    PaymentsWorkspaceState,
    PaymentsOptimisticAction
  >(workspaceState, (currentState, action) =>
    reduceOptimisticPaymentsState(currentState, action, props.filters),
  );
  const [createPending, setCreatePending] = useState(false);
  const [pickerResetSignal, setPickerResetSignal] = useState(0);
  const [selectedCreateClient, setSelectedCreateClient] =
    useState<ClientPickerOption | null>(props.selectedClientPickerOption);
  const [selectedCreateServices, setSelectedCreateServices] = useState<
    PaymentServicePickerOption[]
  >([]);

  useEffect(() => {
    setWorkspaceState(initialState);
  }, [initialState]);

  useEffect(() => {
    setSelectedCreateClient(props.selectedClientPickerOption);
  }, [props.selectedClientPickerOption]);

  const paymentsPageHref = (page: number) =>
    buildClientPaymentHref({
      search: props.filters.search,
      clientId: props.filters.clientId,
      dateFromValue: props.filters.dateFromValue,
      dateToValue: props.filters.dateToValue,
      page,
    }) as Route;
  const visibleStart =
    optimisticState.paymentsPage.total > 0
      ? (optimisticState.paymentsPage.page - 1) *
          optimisticState.paymentsPage.pageSize +
        1
      : 0;
  const visibleEnd =
    optimisticState.paymentsPage.total > 0
      ? visibleStart + optimisticState.paymentsPage.items.length - 1
      : 0;
  const paginationSummary = optimisticState.paymentsPage.total
    ? `Affichage ${visibleStart}-${visibleEnd} sur ${optimisticState.paymentsPage.total} paiements`
    : "Aucun paiement";

  function handleCreatePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending || pending) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    if (!selectedCreateClient) {
      addToast({
        variant: "error",
        title: "Sélectionnez un client avant d'enregistrer le paiement.",
      });
      return;
    }
    if (selectedCreateServices.length === 0) {
      addToast({
        variant: "error",
        title: "Sélectionnez au moins un service à lier au paiement.",
      });
      return;
    }

    formData.set("clientId", selectedCreateClient.id);
    formData.delete("clientServiceIds");
    selectedCreateServices.forEach((service) => {
      formData.append("clientServiceIds", service.id);
    });

    const optimisticPayment = buildOptimisticPayment(
      formData,
      selectedCreateClient,
      selectedCreateServices,
      props.currency,
    );
    const matchesFilters = matchesPaymentFilters(optimisticPayment, props.filters);

    setCreatePending(true);

    startTransition(async () => {
      applyOptimisticUpdate({
        type: "create",
        payment: optimisticPayment,
        matchesFilters,
      });
      try {
        const result = await createClientPaymentInlineAction(formData);
        const nextPayment = result.data?.payment;
        if (result.status !== "success" || !nextPayment) {
          setWorkspaceState((current) => ({ ...current }));
          addToast({
            variant: "error",
            title: result.message,
          });
          return;
        }

        setWorkspaceState((current) =>
          reduceOptimisticPaymentsState(
            current,
            {
              type: "create",
              payment: nextPayment,
              matchesFilters: matchesPaymentFilters(nextPayment, props.filters),
            },
            props.filters,
          ),
        );
        addToast({
          variant: "success",
          title: result.message,
        });
        form.reset();
        setSelectedCreateClient(props.selectedClientPickerOption);
        setSelectedCreateServices([]);
        setPickerResetSignal((current) => current + 1);
        router.refresh();
      } catch (error) {
        setWorkspaceState((current) => ({ ...current }));
        addToast({
          variant: "error",
          title:
            error instanceof Error
              ? error.message
              : "Impossible d'enregistrer ce paiement.",
        });
      } finally {
        setCreatePending(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Paiements</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {optimisticState.summary.paymentCount}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Recus generes</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {optimisticState.summary.receiptCount}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Clients concernes</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {optimisticState.summary.clientCount}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Totaux</p>
          <div className="mt-2 space-y-1">
            {optimisticState.summary.totalsByCurrency.length ? (
              optimisticState.summary.totalsByCurrency.map((entry) => (
                <p
                  key={entry.currency}
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  {formatCurrency(
                    fromCents(entry.totalAmountCents, entry.currency),
                    entry.currency,
                  )}
                </p>
              ))
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun total</p>
            )}
          </div>
        </div>
      </section>

      {props.canManagePayments ? (
        <section className="card space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Nouveau paiement
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Creez un paiement directement depuis cette section en choisissant
                le client et les services du catalogue global.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {props.selectedClient ? (
                <>
                  <Badge
                    variant={props.selectedClient.isActive ? "success" : "neutral"}
                  >
                    {props.selectedClient.isActive ? "Client actif" : "Client inactif"}
                  </Badge>
                  <Badge variant="info">
                    Historique filtre : {props.selectedClient.displayName}
                  </Badge>
                </>
              ) : null}
              <Button asChild variant="ghost">
                <PrefetchLink href="/services" prefetch={false}>
                  Catalogue des services
                </PrefetchLink>
              </Button>
            </div>
          </div>

          {props.hasAnyClients ? (
            <form onSubmit={handleCreatePaymentSubmit} className="space-y-4">
              <input type="hidden" name="currency" value={props.currency} />
              <input
                type="hidden"
                name="redirectTo"
                value={paymentsPageHref(props.currentPage)}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="label" htmlFor="payment-client">
                    Client
                  </label>
                  <AsyncClientPicker
                    key={`payment-client-${props.selectedClientPickerOption?.id ?? "none"}-${pickerResetSignal}`}
                    id="payment-client"
                    name="clientId"
                    initialSelection={props.selectedClientPickerOption}
                    placeholder="Choisir un client"
                    emptyLabel="Aucun client sélectionné"
                    disabled={createPending}
                    onSelectionChange={setSelectedCreateClient}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label" htmlFor="payment-date">
                    Date du paiement
                  </label>
                  <input
                    id="payment-date"
                    name="date"
                    type="date"
                    className="input"
                    defaultValue={formatDateInputValue(new Date())}
                    required
                    disabled={createPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label" htmlFor="payment-amount">
                    Montant ({props.currency})
                  </label>
                  <Input
                    id="payment-amount"
                    name="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                    disabled={createPending}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="label" htmlFor="payment-method">
                    Mode de paiement
                  </label>
                  <Select
                    id="payment-method"
                    name="method"
                    defaultValue={props.paymentMethodOptions[0] ?? ""}
                    disabled={createPending || props.paymentMethodOptions.length === 0}
                    required
                  >
                    {props.paymentMethodOptions.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Liste configurable depuis Paramètres.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="label" htmlFor="payment-reference">
                    Reference
                  </label>
                  <Input
                    id="payment-reference"
                    name="reference"
                    disabled={createPending}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="label" htmlFor="payment-description">
                  Description
                </label>
                <Input
                  id="payment-description"
                  name="description"
                  disabled={createPending}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="label" htmlFor="payment-note">
                    Note
                  </label>
                  <Textarea
                    id="payment-note"
                    name="note"
                    rows={3}
                    disabled={createPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label" htmlFor="payment-private-note">
                    Note privee
                  </label>
                  <Textarea
                    id="payment-private-note"
                    name="privateNote"
                    rows={3}
                    disabled={createPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="label">Lier aux services du compte</p>
                <PaymentServiceMultiPicker
                  key={`payment-services-${pickerResetSignal}`}
                  name="clientServiceIds"
                  currency={props.currency}
                  disabled={createPending}
                  onSelectionChange={setSelectedCreateServices}
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Recherchez uniquement les services utiles au paiement. Vous pouvez
                  lier un ou plusieurs services du catalogue au reçu.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                {createPending ? (
                  <span className="text-xs text-blue-600 dark:text-blue-300">
                    Enregistrement en cours...
                  </span>
                ) : null}
                <Button type="submit" loading={createPending}>
                  Enregistrer le paiement
                </Button>
              </div>
            </form>
          ) : (
            <Alert
              variant="warning"
              title="Ajoutez d'abord un client"
              description="Un client doit exister dans le compte avant de pouvoir enregistrer un paiement."
            />
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Paiements enregistres
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Liste ordonnee des paiements avec recherche et ouverture du detail.
            </p>
          </div>
          {props.filters.clientId && props.selectedClient ? (
            <Button asChild variant="ghost">
              <PrefetchLink
                href={`/clients/${props.selectedClient.id}` as Route}
                prefetch={false}
              >
                Ouvrir le client
              </PrefetchLink>
            </Button>
          ) : null}
        </div>

        {props.filters.clientId && !props.selectedClient ? (
          <Alert
            variant="warning"
            title="Client introuvable"
            description="Le filtre client selectionne n’est plus accessible sur ce compte."
          />
        ) : null}

        <PaginationControls
          page={optimisticState.paymentsPage.page}
          pageCount={optimisticState.paymentsPage.pageCount}
          buildHref={paymentsPageHref}
          summary={paginationSummary}
        />

        {optimisticState.paymentsPage.items.length ? (
          optimisticState.paymentsPage.items.map((payment) => {
            const isPaymentReady = isPersistedClientPayment(payment);
            const paymentDetailHref = buildClientPaymentHref(
              {
                search: props.filters.search,
                clientId: props.filters.clientId,
                dateFromValue: props.filters.dateFromValue,
                dateToValue: props.filters.dateToValue,
                page: props.currentPage,
              },
              `/paiements/${payment.id}`,
            ) as Route;

            return (
              <article key={payment.id} className="card space-y-4 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(
                          fromCents(payment.amountCents, payment.currency),
                          payment.currency,
                        )}
                      </h3>
                      <Badge variant="neutral">{formatDate(payment.date)}</Badge>
                      {!isPaymentReady ? (
                        <Badge variant="info">Enregistrement...</Badge>
                      ) : payment.receiptNumber ? (
                        <Badge variant="success">{payment.receiptNumber}</Badge>
                      ) : (
                        <Badge variant="info">Recu a generer</Badge>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      {payment.client.displayName}
                      {payment.client.companyName
                        ? ` · ${payment.client.companyName}`
                        : ""}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {payment.description ?? payment.method ?? "Paiement client"}
                    </p>
                    {!isPaymentReady ? (
                      <p className="text-xs text-blue-600 dark:text-blue-300">
                        Le paiement apparait deja dans la liste. Les actions seront
                        disponibles des que l&apos;enregistrement sera confirme.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {isPaymentReady ? (
                      <Button asChild>
                        <PrefetchLink href={paymentDetailHref} prefetch={false}>
                          Details
                        </PrefetchLink>
                      </Button>
                    ) : (
                      <Button type="button" disabled>
                        <PendingActionContent label="Details" />
                      </Button>
                    )}
                    {props.canManageReceipts ? (
                      isPaymentReady ? (
                        <ReceiptPdfButton
                          paymentId={payment.id}
                          label="Recu PDF"
                          variant="ghost"
                        />
                      ) : (
                        <Button type="button" variant="ghost" disabled>
                          <PendingActionContent label="Recu PDF" />
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-zinc-700 dark:text-zinc-300 md:grid-cols-2">
                  <div className="space-y-2">
                    {payment.reference ? <p>Reference : {payment.reference}</p> : null}
                    {payment.method ? <p>Mode : {payment.method}</p> : null}
                    {payment.note ? (
                      <p className="whitespace-pre-line">Note : {payment.note}</p>
                    ) : null}
                    {props.canManagePayments && payment.privateNote ? (
                      <p className="whitespace-pre-line text-zinc-500 dark:text-zinc-400">
                        Note privee : {payment.privateNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <p className="label">Services lies</p>
                    {payment.serviceLinks.length ? (
                      <div className="flex flex-wrap gap-2">
                        {payment.serviceLinks.map((link) => (
                          <Badge key={link.id} variant="info">
                            {link.titleSnapshot}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Aucun service lie.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <Alert
            variant="warning"
            title="Aucun paiement"
            description="Aucun paiement ne correspond aux filtres selectionnes."
          />
        )}

        <PaginationControls
          page={optimisticState.paymentsPage.page}
          pageCount={optimisticState.paymentsPage.pageCount}
          buildHref={paymentsPageHref}
          summary={paginationSummary}
        />
      </section>
    </div>
  );
}
