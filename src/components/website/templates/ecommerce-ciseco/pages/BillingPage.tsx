"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type {
  WebsiteBuilderPageConfig,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../types";
import { resolveBuilderSection } from "../builder-helpers";
import {
  buildAccountBillingHref,
  buildAccountOrdersHref,
  parsePositiveInteger,
  resolveAccountBasePath,
  resolveCatalogueSlugFromPathname,
  resolveOrderStatusBadgeClass,
  resolveOrderStatusLabel,
  resolvePaymentStatusBadgeClass,
  resolvePaymentStatusLabel,
} from "../account-orders";
import { buildPaginationSequence } from "../collections";
import { AccountTabs } from "../components/account/AccountTabs";
import { ExtraSections } from "../components/builder/ExtraSections";
import { PaginationBar } from "../components/collections/PaginationBar";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import {
  useAccountProfile,
  type ProfileStatus,
} from "../hooks/useAccountProfile";
import { useCisecoI18n } from "../i18n";
import { formatCisecoDate, type CisecoLocale } from "../locale";
import { useCisecoLocation } from "../navigation";

type BillingPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type BillingEligibilityReason =
  | "ELIGIBLE"
  | "ALREADY_INVOICED"
  | "OUTSIDE_REQUEST_MONTH";

type BillingProfile = {
  companyName: string;
  vatNumber: string;
  address: string;
  email: string;
};

type InvoiceRequestSummary = {
  id: string;
  status: "PENDING" | "COMPLETED";
  invoiceId: string | null;
  deliveryEmail: string;
  companyName: string;
  vatNumber: string;
  billingAddress: string;
  requestedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BillingOrder = {
  id: string;
  orderNumber: string;
  status: Parameters<typeof resolveOrderStatusLabel>[0];
  paymentStatus: Parameters<typeof resolvePaymentStatusLabel>[0];
  currency: string;
  totalTTCCents: number;
  amountPaidCents: number;
  createdAt: string;
  updatedAt: string;
  invoiceId: string | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
  }>;
  eligibility: {
    eligible: boolean;
    reason: BillingEligibilityReason;
    timezone: string;
    requestDeadlineAt: string;
  };
  invoiceRequest: InvoiceRequestSummary | null;
};

type BillingOverviewResponse = {
  billingProfile: BillingProfile;
  orders: BillingOrder[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
};

type BillingOverviewState =
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; data: BillingOverviewResponse }
  | { status: "error"; requestKey: string; message: string };

type BillingFormDraft = {
  companyName: string;
  vatNumber: string;
  address: string;
};

type BillingFormFeedback = {
  status: "idle" | "loading" | "success" | "error";
  message: string | null;
  fieldErrors: Partial<Record<keyof BillingFormDraft, string>>;
};

const EMPTY_DRAFT: BillingFormDraft = {
  companyName: "",
  vatNumber: "",
  address: "",
};

const actionButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60";

const inputClassName =
  "w-full rounded-3xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const labelClassName = "text-xs font-semibold text-slate-700";

export function BillingPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: BillingPageProps) {
  const { t, locale, localizeHref } = useCisecoI18n();
  const { pathname, searchParams } = useCisecoLocation();
  const basePath = useMemo(() => resolveAccountBasePath(pathname), [pathname]);
  const slug = useMemo(
    () => resolveCatalogueSlugFromPathname(pathname),
    [pathname],
  );
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const {
    profile,
    status: profileStatus,
    clearProfile,
  } = useAccountProfile({
    redirectOnUnauthorized: true,
    loadStrategy: "mount",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, BillingFormDraft>>({});
  const [feedbackByOrderId, setFeedbackByOrderId] = useState<
    Record<string, BillingFormFeedback>
  >({});

  const headerDetails = useMemo(() => {
    const parts = [profile.email, profile.address].filter(
      (value) => value && value.trim().length > 0,
    ) as string[];
    return parts.join(" · ");
  }, [profile.address, profile.email]);

  const requestHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "6");
    if (slug) {
      params.set("slug", slug);
    }
    return `/api/catalogue/account/billing?${params.toString()}`;
  }, [page, slug]);
  const mutationHref = useMemo(() => {
    if (!slug) {
      return "/api/catalogue/account/billing";
    }
    const params = new URLSearchParams();
    params.set("slug", slug);
    return `/api/catalogue/account/billing?${params.toString()}`;
  }, [slug]);
  const requestKey = `${requestHref}:${reloadKey}`;
  const [overviewState, setOverviewState] = useState<BillingOverviewState>(
    () => ({
      status: "loading",
      requestKey,
    }),
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetch(requestHref, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as
          | BillingOverviewResponse
          | { error?: string };

        if (!active) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          clearProfile();
          return;
        }

        if (!response.ok || !("orders" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : t("Unable to load billing."),
          );
        }

        setOverviewState({
          status: "ready",
          requestKey,
          data: result,
        });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        setOverviewState({
          status: "error",
          requestKey,
          message:
            error instanceof Error
              ? error.message
              : t("Unable to load billing."),
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [clearProfile, requestHref, requestKey, t]);

  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSection(sections, "hero");
  const heroSubtitle = heroSection?.subtitle ?? heroSection?.description ?? null;
  const consumedIds = new Set(
    [heroSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) => section.visible !== false && !consumedIds.has(section.id),
  );
  const viewState =
    overviewState.requestKey === requestKey
      ? overviewState
      : { status: "loading" as const, requestKey };
  const pagination =
    viewState.status === "ready" ? viewState.data.pagination : null;
  const paginationPages = pagination
    ? buildPaginationSequence(pagination.page, pagination.pageCount)
    : [];

  const initializeDraft = (
    order: BillingOrder,
    billingProfile: BillingProfile,
  ) => {
    setDrafts((current) => {
      if (current[order.id]) {
        return current;
      }

      const source = order.invoiceRequest
        ? {
            companyName: order.invoiceRequest.companyName,
            vatNumber: order.invoiceRequest.vatNumber,
            address: order.invoiceRequest.billingAddress,
          }
        : {
            companyName: billingProfile.companyName,
            vatNumber: billingProfile.vatNumber,
            address: billingProfile.address,
          };

      return {
        ...current,
        [order.id]: {
          companyName: source.companyName ?? "",
          vatNumber: source.vatNumber ?? "",
          address: source.address ?? "",
        },
      };
    });
    setFeedbackByOrderId((current) => ({
      ...current,
      [order.id]: current[order.id] ?? {
        status: "idle",
        message: null,
        fieldErrors: {},
      },
    }));
  };

  const handleOrderFormToggle = (order: BillingOrder) => {
    if (viewState.status !== "ready") {
      return;
    }
    initializeDraft(order, viewState.data.billingProfile);
    setExpandedOrderId((current) => (current === order.id ? null : order.id));
  };

  const handleDraftChange = (
    orderId: string,
    field: keyof BillingFormDraft,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? EMPTY_DRAFT),
        [field]: value,
      },
    }));
    setFeedbackByOrderId((current) => ({
      ...current,
      [orderId]: {
        status: "idle",
        message: null,
        fieldErrors: {
          ...(current[orderId]?.fieldErrors ?? {}),
          [field]: undefined,
        },
      },
    }));
  };

  const handleSubmit = async (order: BillingOrder) => {
    const draft = drafts[order.id] ?? EMPTY_DRAFT;

    setFeedbackByOrderId((current) => ({
      ...current,
      [order.id]: {
        status: "loading",
        message: t("Saving request..."),
        fieldErrors: {},
      },
    }));

    try {
      const response = await fetch(mutationHref, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          companyName: draft.companyName,
          vatNumber: draft.vatNumber,
          address: draft.address,
        }),
      });

      const result = (await response.json()) as
        | {
            message: string;
            request: InvoiceRequestSummary;
            billingProfile: BillingProfile;
          }
        | {
            error?: string;
            fieldErrors?: Partial<Record<keyof BillingFormDraft, string>>;
          };

      if (response.status === 401 || response.status === 403) {
        clearProfile();
        return;
      }

      if (!response.ok || !("request" in result)) {
        const message =
          "error" in result && result.error
            ? result.error
            : t("Unable to submit the invoice request.");

        setFeedbackByOrderId((current) => ({
          ...current,
          [order.id]: {
            status: "error",
            message,
            fieldErrors:
              "fieldErrors" in result && result.fieldErrors
                ? result.fieldErrors
                : {},
          },
        }));
        return;
      }

      setOverviewState((current) => {
        if (current.status !== "ready" || current.requestKey !== requestKey) {
          return current;
        }

        return {
          ...current,
          data: {
            ...current.data,
            billingProfile: result.billingProfile,
            orders: current.data.orders.map((entry) =>
              entry.id === order.id
                ? {
                    ...entry,
                    invoiceRequest: result.request,
                  }
                : entry,
            ),
          },
        };
      });
      setExpandedOrderId(null);
      setFeedbackByOrderId((current) => ({
        ...current,
        [order.id]: {
          status: "success",
          message: result.message,
          fieldErrors: {},
        },
      }));
    } catch (error) {
      setFeedbackByOrderId((current) => ({
        ...current,
        [order.id]: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : t("Unable to submit the invoice request."),
          fieldErrors: {},
        },
      }));
    }
  };

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        <div
          className={clsx(
            "mx-auto px-6 pb-20 pt-8 sm:px-8 lg:pt-12",
            theme.containerClass,
          )}
          data-builder-section={heroSection?.id}
        >
          <div className="mx-auto max-w-[860px]">
            <AccountHeader
              name={profile.name}
              details={headerDetails}
              status={profileStatus}
              title={heroSection?.title}
              subtitle={heroSubtitle}
            />
            <div className="mt-6 border-y border-black/5">
              <AccountTabs activeTab="Billing" />
            </div>

            <section className="mt-10">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                  {t("Billing")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t(
                    "Review eligible orders and request a company invoice for this month's purchases.",
                  )}
                </p>
              </div>

              {viewState.status === "loading" ? <BillingLoadingState /> : null}
              {viewState.status === "error" ? (
                <BillingErrorState
                  message={viewState.message}
                  onRetry={() => setReloadKey((current) => current + 1)}
                />
              ) : null}
              {viewState.status === "ready" &&
              viewState.data.orders.length === 0 ? (
                <BillingEmptyState />
              ) : null}
              {viewState.status === "ready" &&
              viewState.data.orders.length > 0 ? (
                <>
                  <div className="mt-8 space-y-6">
                    {viewState.data.orders.map((order) => (
                      <BillingOrderCard
                        key={order.id}
                        order={order}
                        locale={locale}
                        billingProfile={viewState.data.billingProfile}
                        isExpanded={expandedOrderId === order.id}
                        draft={drafts[order.id] ?? EMPTY_DRAFT}
                        feedback={
                          feedbackByOrderId[order.id] ?? {
                            status: "idle",
                            message: null,
                            fieldErrors: {},
                          }
                        }
                        onToggle={() => handleOrderFormToggle(order)}
                        onCancel={() => setExpandedOrderId(null)}
                        onDraftChange={handleDraftChange}
                        onSubmit={() => void handleSubmit(order)}
                        detailHref={buildAccountOrdersHref({
                          basePath,
                          orderId: order.id,
                        })}
                      />
                    ))}
                  </div>
                  {pagination ? (
                    <PaginationBar
                      currentPage={pagination.page}
                      pageCount={pagination.pageCount}
                      pages={paginationPages}
                      hrefForPage={(targetPage) =>
                        localizeHref(
                          buildAccountBillingHref({
                            basePath,
                            page: targetPage,
                          }),
                        )
                      }
                    />
                  ) : null}
                </>
              ) : null}
            </section>
          </div>
        </div>
        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}

function AccountHeader({
  name,
  details,
  status,
  title,
  subtitle,
}: {
  name: string;
  details: string;
  status: ProfileStatus;
  title?: string | null;
  subtitle?: string | null;
}) {
  const { t } = useCisecoI18n();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
        {t(title ?? "Account")}
      </h1>
      {subtitle ? (
        <p className="text-sm text-slate-600">{t(subtitle)}</p>
      ) : null}
      <p className="text-sm text-slate-500 sm:text-base">
        <span className="font-semibold text-slate-900">
          {name || (status === "loading" ? t("Loading...") : "—")}
        </span>
        {details
          ? `, ${details}`
          : status === "loading"
            ? ` · ${t("Loading details...")}`
            : null}
      </p>
    </div>
  );
}

function BillingOrderCard({
  order,
  locale,
  billingProfile,
  isExpanded,
  draft,
  feedback,
  onToggle,
  onCancel,
  onDraftChange,
  onSubmit,
  detailHref,
}: {
  order: BillingOrder;
  locale: CisecoLocale;
  billingProfile: BillingProfile;
  isExpanded: boolean;
  draft: BillingFormDraft;
  feedback: BillingFormFeedback;
  onToggle: () => void;
  onCancel: () => void;
  onDraftChange: (
    orderId: string,
    field: keyof BillingFormDraft,
    value: string,
  ) => void;
  onSubmit: () => void;
  detailHref: string;
}) {
  const { t, localizeHref } = useCisecoI18n();
  const deadlineLabel = formatCisecoDate(
    locale,
    new Date(order.eligibility.requestDeadlineAt),
  );
  const requestLabel = order.invoiceRequest
    ? order.invoiceRequest.status === "COMPLETED"
      ? t("Invoice ready")
      : t("Invoice request received")
    : order.eligibility.eligible
      ? t("Eligible this month")
      : null;
  const requestTone = order.invoiceRequest
    ? order.invoiceRequest.status === "COMPLETED"
      ? "border-emerald-500/20 bg-emerald-50 text-emerald-700"
      : "border-sky-500/20 bg-sky-50 text-sky-700"
    : "border-amber-400/30 bg-amber-50 text-amber-700";
  const canEditRequest = !order.invoiceId && order.eligibility.eligible;
  const hasDraftValues =
    billingProfile.companyName ||
    billingProfile.vatNumber ||
    billingProfile.address;

  return (
    <article className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.55)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {order.orderNumber}
            </h3>
            <p className="text-sm text-slate-500">
              {t("Order date")}:{" "}
              {formatCisecoDate(locale, new Date(order.createdAt))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={clsx(
                "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm",
                resolveOrderStatusBadgeClass(order.status),
              )}
            >
              {t(resolveOrderStatusLabel(order.status))}
            </span>
            <span
              className={clsx(
                "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm",
                resolvePaymentStatusBadgeClass(order.paymentStatus),
              )}
            >
              {t(resolvePaymentStatusLabel(order.paymentStatus))}
            </span>
            {requestLabel ? (
              <span
                className={clsx(
                  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm",
                  requestTone,
                )}
              >
                {requestLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-1 text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t("Total")}
          </p>
          <p className="text-xl font-semibold text-slate-900">
            {formatCurrency(
              fromCents(order.totalTTCCents, order.currency),
              order.currency,
            )}
          </p>
          <a
            href={localizeHref(detailHref)}
            className="text-xs font-semibold text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline"
          >
            {t("View details")}
          </a>
        </div>
      </div>

      {order.items.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {order.items.map((item) => (
            <span
              key={item.id}
              className="inline-flex rounded-full border border-black/5 bg-slate-50 px-3 py-1 text-xs text-slate-600"
            >
              {item.title} × {item.quantity}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {feedback.status === "success" && feedback.message ? (
          <StatusPanel tone="success" message={feedback.message} />
        ) : null}

        {order.invoiceId ? (
          <StatusPanel
            tone="success"
            message={t("An invoice has already been issued for this order.")}
          />
        ) : order.invoiceRequest?.status === "COMPLETED" ? (
          <StatusPanel
            tone="success"
            message={t("This invoice request has already been processed.")}
          />
        ) : order.invoiceRequest ? (
          <StatusPanel
            tone="info"
            message={t(
              "Your invoice request is on file and will be handled using the confirmed billing details below.",
            )}
            meta={`${t("Requested on")} ${formatCisecoDate(
              locale,
              new Date(order.invoiceRequest.requestedAt),
            )} · ${order.invoiceRequest.deliveryEmail}`}
          />
        ) : order.eligibility.eligible ? (
          <StatusPanel
            tone="warning"
            message={
              hasDraftValues
                ? t(
                    "Your saved company billing details will be reused. You can confirm or update them before submitting the request.",
                  )
                : t(
                    "Company billing details are required before an invoice request can be submitted.",
                  )
            }
            meta={`${t("Deadline")}: ${deadlineLabel}`}
          />
        ) : (
          <StatusPanel
            tone="warning"
            message={t(
              "Invoice requests are only available during the same calendar month as the order date.",
            )}
            meta={`${t("Deadline")}: ${deadlineLabel}`}
          />
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={!canEditRequest}
          className={actionButtonClassName}
        >
          {order.invoiceRequest ? t("Update request") : t("Request invoice")}
        </button>
      </div>

      {isExpanded ? (
        <div className="mt-6 rounded-[24px] border border-black/5 bg-slate-50/80 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`${order.id}-company`} className={labelClassName}>
                {t("Billing company name")}
              </label>
              <input
                id={`${order.id}-company`}
                className={inputClassName}
                value={draft.companyName}
                onChange={(event) =>
                  onDraftChange(order.id, "companyName", event.target.value)
                }
                placeholder={t("Billing company name")}
              />
              {feedback.fieldErrors.companyName ? (
                <p className="text-xs font-medium text-rose-600">
                  {feedback.fieldErrors.companyName}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor={`${order.id}-vat`} className={labelClassName}>
                {t("VAT number")}
              </label>
              <input
                id={`${order.id}-vat`}
                className={inputClassName}
                value={draft.vatNumber}
                onChange={(event) =>
                  onDraftChange(order.id, "vatNumber", event.target.value)
                }
                placeholder={t("VAT number")}
              />
              {feedback.fieldErrors.vatNumber ? (
                <p className="text-xs font-medium text-rose-600">
                  {feedback.fieldErrors.vatNumber}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label htmlFor={`${order.id}-address`} className={labelClassName}>
              {t("Full billing address")}
            </label>
            <textarea
              id={`${order.id}-address`}
              rows={4}
              className={clsx(inputClassName, "rounded-[24px]")}
              value={draft.address}
              onChange={(event) =>
                onDraftChange(order.id, "address", event.target.value)
              }
              placeholder={t("Full billing address")}
            />
            {feedback.fieldErrors.address ? (
              <p className="text-xs font-medium text-rose-600">
                {feedback.fieldErrors.address}
              </p>
            ) : null}
          </div>

          {feedback.status === "error" && feedback.message ? (
            <div className="mt-4">
              <StatusPanel tone="danger" message={feedback.message} />
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={feedback.status === "loading"}
              className={primaryButtonClassName}
            >
              {feedback.status === "loading"
                ? t("Saving request...")
                : t("Confirm invoice request")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={feedback.status === "loading"}
              className={actionButtonClassName}
            >
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StatusPanel({
  tone,
  message,
  meta,
}: {
  tone: "success" | "info" | "warning" | "danger";
  message: string;
  meta?: string | null;
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-50 text-emerald-700"
      : tone === "info"
        ? "border-sky-500/20 bg-sky-50 text-sky-700"
        : tone === "danger"
          ? "border-rose-500/20 bg-rose-50 text-rose-700"
          : "border-amber-400/30 bg-amber-50 text-amber-700";

  return (
    <div className={clsx("rounded-[22px] border px-4 py-3 text-sm", toneClassName)}>
      <p className="font-medium">{message}</p>
      {meta ? <p className="mt-1 text-xs opacity-80">{meta}</p> : null}
    </div>
  );
}

function BillingLoadingState() {
  return (
    <div className="mt-8 space-y-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.55)]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div className="space-y-3">
              <div className="h-5 w-40 rounded-full bg-slate-200" />
              <div className="h-4 w-32 rounded-full bg-slate-100" />
              <div className="flex gap-2">
                <div className="h-7 w-24 rounded-full bg-slate-100" />
                <div className="h-7 w-28 rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="space-y-3 sm:text-right">
              <div className="h-3 w-16 rounded-full bg-slate-100 sm:ml-auto" />
              <div className="h-6 w-28 rounded-full bg-slate-200 sm:ml-auto" />
            </div>
          </div>
          <div className="mt-5 h-20 rounded-[24px] bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

function BillingErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useCisecoI18n();

  return (
    <div className="mt-8 rounded-[28px] border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">
      <p className="font-medium">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 text-xs font-semibold underline">
        {t("Try again")}
      </button>
    </div>
  );
}

function BillingEmptyState() {
  const { t } = useCisecoI18n();

  return (
    <div className="mt-8 rounded-[28px] border border-dashed border-black/10 bg-white/90 p-8 text-center">
      <h3 className="text-base font-semibold text-slate-900">
        {t("No orders available for billing.")}
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        {t(
          "Your eligible orders will appear here as soon as they are confirmed.",
        )}
      </p>
    </div>
  );
}
