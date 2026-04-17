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
  buildAccountOrdersHref,
  type AccountOrderDetail,
  type AccountOrderDetailResponse,
  resolveAccountBasePath,
  resolveCatalogueSlugFromPathname,
  resolveOrderDetailId,
  resolveOrderProgressStep,
  resolveOrderStatusBadgeClass,
  resolveOrderStatusLabel,
  resolvePaymentMethodLabel,
  resolvePaymentStatusBadgeClass,
  resolvePaymentStatusLabel,
  resolveProofStatusLabel,
  resolveTimelineToneClass,
} from "../account-orders";
import { AccountTabs } from "../components/account/AccountTabs";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { CatalogImage } from "../components/shared/CatalogImage";
import {
  useAccountProfile,
  type ProfileStatus,
} from "../hooks/useAccountProfile";
import { useCisecoI18n } from "../i18n";
import { formatCisecoDate, type CisecoLocale } from "../locale";
import { useCisecoLocation } from "../navigation";

type OrderDetailPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  builder?: WebsiteBuilderPageConfig | null;
};

type OrderState =
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; order: AccountOrderDetail }
  | { status: "error"; requestKey: string; message: string };

const ORDER_STEPS = ["Commande", "Paiement", "Preparation", "Livraison"];

const actionButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-200 hover:text-slate-900";

const statusBadgeBaseClassName =
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm";

export function OrderDetailPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  builder,
}: OrderDetailPageProps) {
  const { t, locale, localizeHref } = useCisecoI18n();
  const { pathname, logicalPath } = useCisecoLocation();
  const basePath = useMemo(() => resolveAccountBasePath(pathname), [pathname]);
  const slug = useMemo(
    () => resolveCatalogueSlugFromPathname(pathname),
    [pathname],
  );
  const orderId = useMemo(() => resolveOrderDetailId(logicalPath), [logicalPath]);
  const {
    profile,
    status: profileStatus,
    clearProfile,
  } = useAccountProfile({
    redirectOnUnauthorized: true,
    loadStrategy: "mount",
  });
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${orderId ?? "missing"}:${slug ?? "domain"}:${reloadKey}`;
  const [orderState, setOrderState] = useState<OrderState>(() => ({
    status: "loading",
    requestKey,
  }));

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams();
    if (slug) {
      params.set("slug", slug);
    }

    fetch(`/api/catalogue/orders/${encodeURIComponent(orderId)}?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as
          | AccountOrderDetailResponse
          | { error?: string };

        if (!active) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          clearProfile();
          return;
        }

        if (!response.ok || !("order" in result)) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : t("Unable to fetch order."),
          );
        }

        setOrderState({
          status: "ready",
          requestKey,
          order: result.order,
        });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) {
          return;
        }
        setOrderState({
          status: "error",
          requestKey,
          message:
            error instanceof Error
              ? error.message
              : t("Unable to fetch order."),
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [clearProfile, orderId, requestKey, slug, t]);

  const headerDetails = useMemo(() => {
    const parts = [profile.email, profile.address].filter(
      (value) => value && value.trim().length > 0,
    ) as string[];
    return parts.join(" · ");
  }, [profile.address, profile.email]);

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
  const historyHref = localizeHref(
    buildAccountOrdersHref({
      basePath,
    }),
  );
  const viewState = !orderId
    ? {
        status: "error" as const,
        message: t("Order not found."),
      }
    : orderState.requestKey === requestKey
      ? orderState
      : { status: "loading" as const, requestKey };

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
          <div className="mx-auto max-w-[760px]">
            <AccountHeader
              name={profile.name}
              details={headerDetails}
              status={profileStatus}
              title={heroSection?.title}
              subtitle={heroSubtitle}
            />
            <div className="mt-6 border-y border-black/5">
              <AccountTabs activeTab="Orders history" />
            </div>
            {viewState.status === "loading" ? <OrderDetailLoadingState /> : null}
            {viewState.status === "error" ? (
              <OrderErrorState
                message={viewState.message}
                historyHref={historyHref}
                onRetry={() => setReloadKey((current) => current + 1)}
              />
            ) : null}
            {viewState.status === "ready" ? (
              <OrderContent
                locale={locale}
                order={viewState.order}
                historyHref={historyHref}
              />
            ) : null}
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

function OrderDetailLoadingState() {
  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="h-4 w-40 rounded-full bg-slate-100" />
        <div className="mt-4 h-8 w-56 rounded-full bg-slate-200" />
        <div className="mt-4 flex gap-2">
          <div className="h-6 w-24 rounded-full bg-slate-100" />
          <div className="h-6 w-24 rounded-full bg-slate-100" />
        </div>
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={`order-detail-loading-${index + 1}`}
          className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 rounded-2xl bg-slate-100" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-48 rounded-full bg-slate-200" />
              <div className="h-3 w-32 rounded-full bg-slate-100" />
              <div className="h-3 w-24 rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderErrorState({
  message,
  historyHref,
  onRetry,
}: {
  message: string;
  historyHref: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-6">
      <p className="text-sm font-semibold text-rose-700">
        Cette commande est introuvable ou indisponible
      </p>
      <p className="mt-2 text-sm text-rose-600">{message}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onRetry} className={actionButtonClassName}>
          Reessayer
        </button>
        <a href={historyHref} className={actionButtonClassName}>
          Retour a l&apos;historique
        </a>
      </div>
    </div>
  );
}

function OrderContent({
  order,
  locale,
  historyHref,
}: {
  order: AccountOrderDetail;
  locale: CisecoLocale;
  historyHref: string;
}) {
  return (
    <>
      <div className="mt-8 space-y-2">
        <p className="text-xs text-slate-500">
          Commande passee le{" "}
          {formatCisecoDate(locale, order.createdAt, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Commande {order.orderNumber}
              </h2>
              <span
                className={clsx(
                  statusBadgeBaseClassName,
                  resolveOrderStatusBadgeClass(order.status),
                )}
              >
                {resolveOrderStatusLabel(order.status)}
              </span>
              <span
                className={clsx(
                  statusBadgeBaseClassName,
                  resolvePaymentStatusBadgeClass(order.paymentStatus),
                )}
              >
                {resolvePaymentStatusLabel(order.paymentStatus)}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Suivez les articles, paiements et etapes de cette commande.
            </p>
          </div>
          <a href={historyHref} className={actionButtonClassName}>
            Retour a l&apos;historique
          </a>
        </div>
      </div>
      <OrderProgressCard order={order} locale={locale} />
      <div className="mt-6 space-y-6">
        {order.items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm"
          >
            <div className="p-4 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                <div className="relative mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center rounded-2xl bg-slate-100 p-6 shadow-sm sm:mx-0 sm:h-24 sm:w-24 sm:max-w-none sm:p-3">
                  {item.image ? (
                    <CatalogImage
                      src={item.image}
                      alt={item.productName ?? item.title}
                      className="h-full w-full object-contain"
                      width={96}
                      height={96}
                    />
                  ) : (
                    <div className="h-full w-full rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900 sm:text-base">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Quantite {item.quantity} {item.unit}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-black/5 bg-slate-50 px-3 py-1">
                        Prix unitaire{" "}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(
                            fromCents(item.unitAmountCents, order.currency),
                            order.currency,
                          )}
                        </span>
                      </span>
                      <span className="rounded-full border border-black/5 bg-slate-50 px-3 py-1">
                        Total{" "}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(
                            fromCents(item.lineTotalCents, order.currency),
                            order.currency,
                          )}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-4 text-xs text-slate-500 sm:min-w-[260px] sm:grid-cols-2 sm:gap-6">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-900">
                        Adresse de facturation
                      </p>
                      <AddressBlock
                        name={order.customer.name}
                        company={order.customer.company}
                        address={order.customer.address}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-900">
                        Contact client
                      </p>
                      <div className="space-y-1">
                        <p>{order.customer.email}</p>
                        {order.customer.phone ? <p>{order.customer.phone}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-8 space-y-6">
        <OrderSummaryCard order={order} />
        <PaymentsCard order={order} locale={locale} />
        <TimelineCard order={order} locale={locale} />
      </div>
    </>
  );
}

function OrderProgressCard({
  order,
  locale,
}: {
  order: AccountOrderDetail;
  locale: CisecoLocale;
}) {
  const currentStep = resolveOrderProgressStep({
    status: order.status,
    paymentStatus: order.paymentStatus,
  });

  return (
    <article className="mt-6 rounded-2xl border border-black/5 bg-white px-5 py-6 shadow-sm sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Statut de la commande
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {resolveOrderStatusLabel(order.status)} ·{" "}
            {resolvePaymentStatusLabel(order.paymentStatus)}
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Derniere mise a jour le {formatCisecoDate(locale, order.updatedAt)}
        </p>
      </div>
      <ProgressTracker currentStep={currentStep} />
    </article>
  );
}

function ProgressTracker({ currentStep }: { currentStep: number }) {
  const clampedStep = Math.min(Math.max(currentStep, 0), ORDER_STEPS.length - 1);
  const progress = (clampedStep / (ORDER_STEPS.length - 1)) * 100;

  return (
    <div className="mt-5">
      <div className="relative h-1.5 w-full rounded-full bg-slate-200">
        <span
          className="absolute left-0 top-0 h-1.5 rounded-full bg-slate-900"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
        {ORDER_STEPS.map((step, index) => {
          const isCurrent = index === clampedStep;
          const isDone = index < clampedStep;
          return (
            <span
              key={step}
              className={clsx(
                "text-left",
                isCurrent
                  ? "font-semibold text-slate-900"
                  : isDone
                    ? "text-slate-700"
                    : "text-slate-400",
              )}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function OrderSummaryCard({ order }: { order: AccountOrderDetail }) {
  const latestPayment = order.payments[0] ?? null;
  const balanceCents = Math.max(0, order.totalTTCCents - order.amountPaidCents);

  return (
    <article className="rounded-2xl border border-black/5 bg-slate-50/70 px-5 py-6 shadow-sm sm:px-6">
      <div className="grid gap-6 sm:gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="space-y-2 text-xs text-slate-500">
          <p className="text-xs font-semibold text-slate-900">
            Adresse de facturation
          </p>
          <AddressBlock
            name={order.customer.name}
            company={order.customer.company}
            address={order.customer.address}
          />
        </div>
        <div className="space-y-3 text-xs text-slate-500">
          <p className="text-xs font-semibold text-slate-900">
            Paiement
          </p>
          <div className="space-y-1">
            <p>{resolvePaymentMethodLabel(latestPayment?.method ?? null)}</p>
            <p>{resolvePaymentStatusLabel(order.paymentStatus)}</p>
            {latestPayment?.externalReference ? (
              <p>Reference: {latestPayment.externalReference}</p>
            ) : null}
            {latestPayment?.proofStatus ? (
              <p>{resolveProofStatusLabel(latestPayment.proofStatus)}</p>
            ) : null}
          </div>
          {order.notes ? (
            <div className="rounded-2xl border border-black/5 bg-white/80 px-3 py-3">
              <p className="text-xs font-semibold text-slate-900">Note</p>
              <p className="mt-1 text-xs text-slate-500">{order.notes}</p>
            </div>
          ) : null}
        </div>
        <div className="space-y-2 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Sous-total HT</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(
                fromCents(order.subtotalHTCents, order.currency),
                order.currency,
              )}
            </span>
          </div>
          {order.totalDiscountCents > 0 ? (
            <div className="flex items-center justify-between">
              <span>Remise</span>
              <span className="font-semibold text-slate-900">
                -{" "}
                {formatCurrency(
                  fromCents(order.totalDiscountCents, order.currency),
                  order.currency,
                )}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span>TVA</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(
                fromCents(order.totalTVACents, order.currency),
                order.currency,
              )}
            </span>
          </div>
          <div className="my-3 border-t border-black/5" />
          <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
            <span>Total TTC</span>
            <span>
              {formatCurrency(
                fromCents(order.totalTTCCents, order.currency),
                order.currency,
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Montant paye</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(
                fromCents(order.amountPaidCents, order.currency),
                order.currency,
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Reste a payer</span>
            <span className="font-semibold text-slate-900">
              {formatCurrency(
                fromCents(balanceCents, order.currency),
                order.currency,
              )}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function PaymentsCard({
  order,
  locale,
}: {
  order: AccountOrderDetail;
  locale: CisecoLocale;
}) {
  return (
    <article className="rounded-2xl border border-black/5 bg-white px-5 py-6 shadow-sm sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">
          Paiements
        </h3>
        <span className="text-xs text-slate-500">
          {order.payments.length} enregistrement(s)
        </span>
      </div>
      {order.payments.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Aucun paiement n&apos;est encore enregistre pour cette commande.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {order.payments.map((payment) => (
            <div
              key={payment.id}
              className="rounded-2xl border border-black/5 bg-slate-50/60 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(
                      fromCents(payment.amountCents, payment.currency),
                      payment.currency,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {resolvePaymentMethodLabel(payment.method)} ·{" "}
                    {formatCisecoDate(locale, payment.paidAt ?? payment.createdAt, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={clsx(
                      statusBadgeBaseClassName,
                      resolvePaymentStatusBadgeClass(payment.status),
                    )}
                  >
                    {resolvePaymentStatusLabel(payment.status)}
                  </span>
                  {payment.proofStatus ? (
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                      {resolveProofStatusLabel(payment.proofStatus)}
                    </span>
                  ) : null}
                </div>
              </div>
              {(payment.externalReference || payment.proofUrl) && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  {payment.externalReference ? (
                    <span>Reference: {payment.externalReference}</span>
                  ) : null}
                  {payment.proofUrl ? (
                    <a
                      href={payment.proofUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-slate-700 underline-offset-2 hover:underline"
                    >
                      Ouvrir le justificatif
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function TimelineCard({
  order,
  locale,
}: {
  order: AccountOrderDetail;
  locale: CisecoLocale;
}) {
  return (
    <article className="rounded-2xl border border-black/5 bg-white px-5 py-6 shadow-sm sm:px-6">
      <h3 className="text-base font-semibold text-slate-900">
        Historique
      </h3>
      <div className="mt-5 space-y-3">
        {order.timeline.map((entry) => (
          <div
            key={entry.id}
            className={clsx(
              "rounded-2xl border px-4 py-4",
              resolveTimelineToneClass(entry.tone),
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{entry.label}</p>
                {entry.description ? (
                  <p className="mt-1 text-xs opacity-80">{entry.description}</p>
                ) : null}
              </div>
              <p className="text-xs opacity-80">
                {formatCisecoDate(locale, entry.occurredAt, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function AddressBlock({
  name,
  company,
  address,
}: {
  name: string;
  company: string | null;
  address: string | null;
}) {
  const addressLines = (address ?? "")
    .split(",")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-1 text-xs text-slate-500">
      <p>{name}</p>
      {company ? <p>{company}</p> : null}
      {addressLines.length > 0 ? (
        addressLines.map((line) => <p key={line}>{line}</p>)
      ) : (
        <p>Adresse non renseignee</p>
      )}
    </div>
  );
}
