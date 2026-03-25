"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useToast } from "@/components/ui/toast-provider";
import { formatCurrency } from "@/lib/formatters";
import { getCurrencyInfo } from "@/lib/currency";
import { fromCents, parseMinorUnitInput } from "@/lib/money";
import {
  createPaymentServiceInlineAction,
  deletePaymentServiceInlineAction,
  updatePaymentServiceInlineAction,
  type SerializedPaymentService,
} from "@/app/(app)/services/actions";
import { listPaymentServicesPage } from "@/server/client-payments";

type ServiceManagementPanelProps = {
  currency: string;
  canManageServices: boolean;
  redirectBase: string;
  search: string;
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  activeCount: number;
  inactiveCount: number;
  services: Awaited<ReturnType<typeof listPaymentServicesPage>>["items"];
};

type ServiceListState = {
  items: SerializedPaymentService[];
  total: number;
  activeCount: number;
  inactiveCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type ServiceOptimisticAction =
  | {
      type: "create";
      service: SerializedPaymentService;
    }
  | {
      type: "reconcileCreate";
      tempServiceId: string;
      service: SerializedPaymentService;
    }
  | {
      type: "rollbackCreate";
      service: SerializedPaymentService;
    }
  | {
      type: "update";
      service: SerializedPaymentService;
    }
  | {
      type: "delete";
      serviceId: string;
    };

function formatPriceInputValue(priceCents: number, currency: string) {
  const amount = fromCents(priceCents, currency);
  return amount.toFixed(getCurrencyInfo(currency).decimals);
}

function getPriceInputStep(currency: string) {
  const decimals = getCurrencyInfo(currency).decimals;
  return decimals > 0 ? `0.${"0".repeat(decimals - 1)}1` : "1";
}

function buildServicesHref(search: string, page?: number | null) {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("recherche", search.trim());
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/services?${query}` : "/services";
}

function normalizeService(
  service: ServiceManagementPanelProps["services"][number] | SerializedPaymentService,
): SerializedPaymentService {
  return {
    id: service.id,
    title: service.title,
    details: service.details ?? null,
    priceCents: service.priceCents,
    notes: service.notes ?? null,
    privateNotes: service.privateNotes ?? null,
    isActive: service.isActive,
    updatedAt:
      typeof service.updatedAt === "string"
        ? service.updatedAt
        : service.updatedAt.toISOString(),
  };
}

function matchesServiceSearch(
  service: Pick<
    SerializedPaymentService,
    "title" | "details" | "notes" | "privateNotes"
  >,
  search: string,
) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return [
    service.title,
    service.details ?? "",
    service.notes ?? "",
    service.privateNotes ?? "",
  ].some((value) => value.toLowerCase().includes(normalizedSearch));
}

function sortServices(items: SerializedPaymentService[]) {
  return [...items].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function createInitialState({
  services,
  total,
  activeCount,
  inactiveCount,
  page,
  pageSize,
  pageCount,
}: ServiceManagementPanelProps): ServiceListState {
  return {
    items: services.map(normalizeService),
    total,
    activeCount,
    inactiveCount,
    page,
    pageSize,
    pageCount,
  };
}

function reduceServiceState(
  state: ServiceListState,
  action: ServiceOptimisticAction,
  search: string,
) {
  switch (action.type) {
    case "create": {
      if (!matchesServiceSearch(action.service, search)) {
        return state;
      }

      const items =
        state.page === 1
          ? sortServices([action.service, ...state.items]).slice(0, state.pageSize)
          : state.items;
      const total = state.total + 1;
      const activeCount = state.activeCount + (action.service.isActive ? 1 : 0);
      const inactiveCount =
        state.inactiveCount + (action.service.isActive ? 0 : 1);

      return {
        ...state,
        items,
        total,
        activeCount,
        inactiveCount,
        pageCount: Math.max(1, Math.ceil(total / state.pageSize)),
      };
    }
    case "reconcileCreate": {
      const temporaryService = state.items.find(
        (service) => service.id === action.tempServiceId,
      );

      if (!temporaryService) {
        return state;
      }

      const stillMatches = matchesServiceSearch(action.service, search);

      if (!stillMatches) {
        const total = Math.max(state.total - 1, 0);
        return {
          ...state,
          items: state.items.filter(
            (service) => service.id !== action.tempServiceId,
          ),
          total,
          activeCount: Math.max(
            state.activeCount - Number(temporaryService.isActive),
            0,
          ),
          inactiveCount: Math.max(
            state.inactiveCount - Number(!temporaryService.isActive),
            0,
          ),
          pageCount: Math.max(1, Math.ceil(Math.max(total, 1) / state.pageSize)),
        };
      }

      const activeDelta =
        Number(action.service.isActive) - Number(temporaryService.isActive);

      return {
        ...state,
        items: sortServices(
          state.items
            .filter((service) => service.id !== action.service.id)
            .map((service) =>
              service.id === action.tempServiceId ? action.service : service,
            ),
        ).slice(0, state.pageSize),
        activeCount: Math.max(state.activeCount + activeDelta, 0),
        inactiveCount: Math.max(state.inactiveCount - activeDelta, 0),
      };
    }
    case "rollbackCreate": {
      if (!matchesServiceSearch(action.service, search)) {
        return state;
      }

      const total = Math.max(state.total - 1, 0);
      return {
        ...state,
        items: state.items.filter((service) => service.id !== action.service.id),
        total,
        activeCount: Math.max(
          state.activeCount - Number(action.service.isActive),
          0,
        ),
        inactiveCount: Math.max(
          state.inactiveCount - Number(!action.service.isActive),
          0,
        ),
        pageCount: Math.max(1, Math.ceil(Math.max(total, 1) / state.pageSize)),
      };
    }
    case "update": {
      const existing = state.items.find((service) => service.id === action.service.id);
      if (!existing) {
        return state;
      }

      const stillMatches = matchesServiceSearch(action.service, search);
      const nextItems = stillMatches
        ? sortServices(
            state.items.map((service) =>
              service.id === action.service.id ? action.service : service,
            ),
          )
        : state.items.filter((service) => service.id !== action.service.id);
      const activeDelta =
        Number(action.service.isActive) - Number(existing.isActive);
      const total = stillMatches ? state.total : Math.max(state.total - 1, 0);
      const activeCount = stillMatches
        ? state.activeCount + activeDelta
        : state.activeCount - Number(existing.isActive);
      const inactiveCount = stillMatches
        ? state.inactiveCount - activeDelta
        : state.inactiveCount - Number(!existing.isActive);

      return {
        ...state,
        items: nextItems.slice(0, state.pageSize),
        total,
        activeCount: Math.max(activeCount, 0),
        inactiveCount: Math.max(inactiveCount, 0),
        pageCount: Math.max(1, Math.ceil(Math.max(total, 1) / state.pageSize)),
      };
    }
    case "delete": {
      const existing = state.items.find((service) => service.id === action.serviceId);
      if (!existing) {
        return state;
      }

      const total = Math.max(state.total - 1, 0);
      return {
        ...state,
        items: state.items.filter((service) => service.id !== action.serviceId),
        total,
        activeCount: Math.max(
          state.activeCount - Number(existing.isActive),
          0,
        ),
        inactiveCount: Math.max(
          state.inactiveCount - Number(!existing.isActive),
          0,
        ),
        pageCount: Math.max(1, Math.ceil(Math.max(total, 1) / state.pageSize)),
      };
    }
    default: {
      return state;
    }
  }
}

export function ServiceManagementPanel(props: ServiceManagementPanelProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isMutating, startMutation] = useTransition();
  const createFormRef = useRef<HTMLFormElement | null>(null);
  const initialState = useMemo(() => createInitialState(props), [props]);
  const [serviceState, setServiceState] = useState<ServiceListState>(initialState);
  const [optimisticState, applyOptimisticUpdate] = useOptimistic<
    ServiceListState,
    ServiceOptimisticAction
  >(serviceState, (currentState, action) =>
    reduceServiceState(currentState, action, props.search),
  );
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingRows, setPendingRows] = useState<
    Record<string, "update" | "delete">
  >({});
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  useEffect(() => {
    setServiceState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (
      expandedServiceId &&
      !optimisticState.items.some((service) => service.id === expandedServiceId)
    ) {
      setExpandedServiceId(null);
    }
  }, [expandedServiceId, optimisticState.items]);

  const visibleStart =
    optimisticState.total > 0
      ? (optimisticState.page - 1) * optimisticState.pageSize + 1
      : 0;
  const visibleEnd =
    optimisticState.total > 0
      ? visibleStart + optimisticState.items.length - 1
      : 0;
  const paginationSummary = optimisticState.total
    ? `Affichage ${visibleStart}-${visibleEnd} sur ${optimisticState.total} services`
    : "Aucun service";

  function setRowPending(serviceId: string, status: "update" | "delete" | null) {
    setPendingRows((current) => {
      if (!status) {
        const next = { ...current };
        delete next[serviceId];
        return next;
      }
      return {
        ...current,
        [serviceId]: status,
      };
    });
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingCreate || isMutating) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const optimisticService = normalizeService({
      id: `temp-service-${Date.now()}`,
      title: formData.get("title")?.toString().trim() ?? "",
      details: formData.get("details")?.toString().trim() || null,
      priceCents: parseMinorUnitInput(formData.get("price"), props.currency),
      notes: formData.get("notes")?.toString().trim() || null,
      privateNotes: formData.get("privateNotes")?.toString().trim() || null,
      isActive: (formData.get("isActive")?.toString() ?? "true") !== "false",
      updatedAt: new Date().toISOString(),
    });

    setPendingCreate(true);
    setServiceState((current) =>
      reduceServiceState(
        current,
        { type: "create", service: optimisticService },
        props.search,
      ),
    );

    startMutation(async () => {
      try {
        const result = await createPaymentServiceInlineAction(formData);
        const nextService = result.data?.service;
        if (result.status !== "success" || !nextService) {
          setServiceState((current) =>
            reduceServiceState(
              current,
              { type: "rollbackCreate", service: optimisticService },
              props.search,
            ),
          );
          addToast({
            variant: "error",
            title: result.message,
          });
          return;
        }

        setServiceState((current) =>
          reduceServiceState(
            current,
            {
              type: "reconcileCreate",
              tempServiceId: optimisticService.id,
              service: nextService,
            },
            props.search,
          ),
        );
        addToast({
          variant: "success",
          title: result.message,
        });
        form.reset();
        router.refresh();
      } catch (error) {
        setServiceState((current) =>
          reduceServiceState(
            current,
            { type: "rollbackCreate", service: optimisticService },
            props.search,
          ),
        );
        addToast({
          variant: "error",
          title:
            error instanceof Error
              ? error.message
              : "Impossible d'ajouter ce service.",
        });
      } finally {
        setPendingCreate(false);
      }
    });
  }

  function handleUpdateSubmit(
    serviceId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (pendingRows[serviceId]) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const optimisticService = normalizeService({
      id: serviceId,
      title: formData.get("title")?.toString().trim() ?? "",
      details: formData.get("details")?.toString().trim() || null,
      priceCents: parseMinorUnitInput(formData.get("price"), props.currency),
      notes: formData.get("notes")?.toString().trim() || null,
      privateNotes: formData.get("privateNotes")?.toString().trim() || null,
      isActive: (formData.get("isActive")?.toString() ?? "true") !== "false",
      updatedAt: new Date().toISOString(),
    });

    setRowPending(serviceId, "update");

    startMutation(async () => {
      applyOptimisticUpdate({
        type: "update",
        service: optimisticService,
      });
      try {
        const result = await updatePaymentServiceInlineAction(serviceId, formData);
        const nextService = result.data?.service;
        if (result.status !== "success" || !nextService) {
          setServiceState((current) => ({ ...current }));
          addToast({
            variant: "error",
            title: result.message,
          });
          return;
        }

        setServiceState((current) =>
          reduceServiceState(
            current,
            { type: "update", service: nextService },
            props.search,
          ),
        );
        addToast({
          variant: "success",
          title: result.message,
        });
        router.refresh();
      } catch (error) {
        setServiceState((current) => ({ ...current }));
        addToast({
          variant: "error",
          title:
            error instanceof Error
              ? error.message
              : "Impossible de mettre à jour ce service.",
        });
      } finally {
        setRowPending(serviceId, null);
      }
    });
  }

  function handleDeleteSubmit(
    serviceId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (pendingRows[serviceId]) {
      return;
    }

    setRowPending(serviceId, "delete");

    startMutation(async () => {
      applyOptimisticUpdate({
        type: "delete",
        serviceId,
      });
      try {
        const result = await deletePaymentServiceInlineAction(serviceId);
        if (result.status !== "success") {
          setServiceState((current) => ({ ...current }));
          addToast({
            variant: "error",
            title: result.message,
          });
          return;
        }

        setServiceState((current) =>
          reduceServiceState(current, { type: "delete", serviceId }, props.search),
        );
        addToast({
          variant: "success",
          title: result.message,
        });
        router.refresh();
      } catch (error) {
        setServiceState((current) => ({ ...current }));
        addToast({
          variant: "error",
          title:
            error instanceof Error
              ? error.message
              : "Impossible de supprimer ce service.",
        });
      } finally {
        setRowPending(serviceId, null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Services catalogues
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {optimisticState.total}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Services actifs
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {optimisticState.activeCount}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Services inactifs
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {optimisticState.inactiveCount}
          </p>
        </div>
      </section>

      <PaginationControls
        page={optimisticState.page}
        pageCount={optimisticState.pageCount}
        buildHref={(targetPage) => buildServicesHref(props.search, targetPage)}
        summary={paginationSummary}
      />

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Catalogue des services
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Gerez les services reutilisables dans tout le compte depuis cette
            section dediee.
          </p>
        </div>

        <div className="space-y-4">
          {optimisticState.items.length ? (
            optimisticState.items.map((service) => {
              const pendingState = pendingRows[service.id] ?? null;
              const isExpanded = expandedServiceId === service.id;
              return (
                <div
                  key={service.id}
                  className="rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {service.title}
                          </p>
                          <Badge variant="info">
                            {formatCurrency(
                              fromCents(service.priceCents, props.currency),
                              props.currency,
                            )}
                          </Badge>
                          <Badge variant={service.isActive ? "success" : "neutral"}>
                            {service.isActive ? "Actif" : "Inactif"}
                          </Badge>
                          {pendingState === "update" ? (
                            <span className="text-xs text-blue-600 dark:text-blue-300">
                              Mise a jour...
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">
                          {service.details ?? "Aucun detail"}
                        </p>
                        {service.notes ? (
                          <p className="line-clamp-2 whitespace-pre-line text-sm text-zinc-500 dark:text-zinc-400">
                            {service.notes}
                          </p>
                        ) : null}
                      </div>

                      {props.canManageServices ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={isExpanded ? "secondary" : "ghost"}
                            onClick={() =>
                              setExpandedServiceId((current) =>
                                current === service.id ? null : service.id,
                              )
                            }
                            disabled={pendingState === "delete"}
                          >
                            {isExpanded ? "Fermer" : "Modifier"}
                          </Button>
                          <form
                            onSubmit={(event) => handleDeleteSubmit(service.id, event)}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              loading={pendingState === "delete"}
                              className="text-red-600 dark:text-red-400"
                            >
                              Supprimer
                            </Button>
                          </form>
                        </div>
                      ) : null}
                    </div>

                    {props.canManageServices && isExpanded ? (
                      <form
                        onSubmit={(event) => handleUpdateSubmit(service.id, event)}
                        className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
                      >
                        <input type="hidden" name="redirectTo" value={props.redirectBase} />
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1 sm:col-span-2">
                            <label
                              className="label"
                              htmlFor={`service-title-${service.id}`}
                            >
                              Nom du service
                            </label>
                            <Input
                              id={`service-title-${service.id}`}
                              name="title"
                              defaultValue={service.title}
                              required
                              disabled={pendingState === "delete"}
                            />
                          </div>
                          <div className="space-y-1">
                            <label
                              className="label"
                              htmlFor={`service-price-${service.id}`}
                            >
                              Prix ({props.currency})
                            </label>
                            <Input
                              id={`service-price-${service.id}`}
                              name="price"
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step={getPriceInputStep(props.currency)}
                              defaultValue={formatPriceInputValue(
                                service.priceCents,
                                props.currency,
                              )}
                              required
                              disabled={pendingState === "delete"}
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label
                              className="label"
                              htmlFor={`service-details-${service.id}`}
                            >
                              Details
                            </label>
                            <Textarea
                              id={`service-details-${service.id}`}
                              name="details"
                              rows={3}
                              defaultValue={service.details ?? ""}
                              disabled={pendingState === "delete"}
                            />
                          </div>
                          <div className="space-y-1">
                            <label
                              className="label"
                              htmlFor={`service-active-${service.id}`}
                            >
                              Statut
                            </label>
                            <select
                              id={`service-active-${service.id}`}
                              name="isActive"
                              className="input"
                              defaultValue={service.isActive ? "true" : "false"}
                              disabled={pendingState === "delete"}
                            >
                              <option value="true">Actif</option>
                              <option value="false">Inactif</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label
                              className="label"
                              htmlFor={`service-notes-${service.id}`}
                            >
                              Notes
                            </label>
                            <Textarea
                              id={`service-notes-${service.id}`}
                              name="notes"
                              rows={3}
                              defaultValue={service.notes ?? ""}
                              disabled={pendingState === "delete"}
                            />
                          </div>
                          <div className="space-y-1">
                            <label
                              className="label"
                              htmlFor={`service-private-${service.id}`}
                            >
                              Notes privees
                            </label>
                            <Textarea
                              id={`service-private-${service.id}`}
                              name="privateNotes"
                              rows={3}
                              defaultValue={service.privateNotes ?? ""}
                              disabled={pendingState === "delete"}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            variant="secondary"
                            loading={pendingState === "update"}
                            disabled={pendingState === "delete"}
                          >
                            Enregistrer
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <Alert
              variant="warning"
              title="Aucun service"
              description="Ajoutez un premier service pour preparer les futurs paiements."
            />
          )}
        </div>

        {props.canManageServices ? (
          <form
            ref={createFormRef}
            onSubmit={handleCreateSubmit}
            className="space-y-3 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
          >
            <input type="hidden" name="redirectTo" value={props.redirectBase} />
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Ajouter un service
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Ce service pourra ensuite etre lie a n&apos;importe quel client
                depuis la section Paiements.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="label" htmlFor="new-service-title">
                  Nom du service
                </label>
                <Input
                  id="new-service-title"
                  name="title"
                  required
                  disabled={pendingCreate}
                />
              </div>
              <div className="space-y-1">
                <label className="label" htmlFor="new-service-price">
                  Prix ({props.currency})
                </label>
                <Input
                  id="new-service-price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={getPriceInputStep(props.currency)}
                  placeholder={formatPriceInputValue(0, props.currency)}
                  required
                  disabled={pendingCreate}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="label" htmlFor="new-service-details">
                  Details
                </label>
                <Textarea
                  id="new-service-details"
                  name="details"
                  rows={3}
                  disabled={pendingCreate}
                />
              </div>
              <div className="space-y-1">
                <label className="label" htmlFor="new-service-active">
                  Statut
                </label>
                <select
                  id="new-service-active"
                  name="isActive"
                  className="input"
                  defaultValue="true"
                  disabled={pendingCreate}
                >
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="label" htmlFor="new-service-notes">
                  Notes
                </label>
                <Textarea
                  id="new-service-notes"
                  name="notes"
                  rows={3}
                  disabled={pendingCreate}
                />
              </div>
              <div className="space-y-1">
                <label className="label" htmlFor="new-service-private">
                  Notes privees
                </label>
                <Textarea
                  id="new-service-private"
                  name="privateNotes"
                  rows={3}
                  disabled={pendingCreate}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              {pendingCreate ? (
                <span className="text-xs text-blue-600 dark:text-blue-300">
                  Ajout en cours...
                </span>
              ) : null}
              <Button type="submit" loading={pendingCreate}>
                Ajouter au catalogue
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <PaginationControls
        page={optimisticState.page}
        pageCount={optimisticState.pageCount}
        buildHref={(targetPage) => buildServicesHref(props.search, targetPage)}
        summary={paginationSummary}
      />
    </div>
  );
}
