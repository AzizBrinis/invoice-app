import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Badge } from "@/components/ui/badge";
import {
  LICENCE_CODE_STATUS_LABELS,
  LICENCE_ORDER_SOURCE_LABELS,
  LICENCE_ORDER_STATUS_LABELS,
  type KasperskyTier,
  type LicenceCodeStatus,
  type LicenceOrderSource,
  type LicenceOrderStatus,
} from "@/lib/digital-products/kaspersky-catalog";

export const KASPERSKY_BASE_PATH = "/produits-digitaux/kaspersky";
export const LOW_STOCK_THRESHOLD = 5;

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Tunis",
});
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date);
}

export function formatIsoDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

const CODE_STATUS_VARIANTS: Record<LicenceCodeStatus, "success" | "warning" | "neutral" | "danger"> = {
  AVAILABLE: "success",
  RESERVED: "warning",
  USED: "neutral",
  REVOKED: "danger",
};

export function CodeStatusBadge({ status }: { status: LicenceCodeStatus }) {
  return <Badge variant={CODE_STATUS_VARIANTS[status]}>{LICENCE_CODE_STATUS_LABELS[status]}</Badge>;
}

const ORDER_STATUS_VARIANTS: Record<LicenceOrderStatus, "success" | "warning" | "info" | "danger"> = {
  PENDING: "warning",
  GENERATED: "success",
  DELIVERED: "info",
  CANCELLED: "danger",
};

export function OrderStatusBadge({ status }: { status: LicenceOrderStatus }) {
  return (
    <Badge variant={ORDER_STATUS_VARIANTS[status]}>{LICENCE_ORDER_STATUS_LABELS[status]}</Badge>
  );
}

export function SourceLabel({ source }: { source: LicenceOrderSource }) {
  return <>{LICENCE_ORDER_SOURCE_LABELS[source] ?? source}</>;
}

export const TIER_ACCENTS: Record<KasperskyTier, string> = {
  standard: "bg-teal-500",
  plus: "bg-emerald-500",
  premium: "bg-violet-600",
};

export function TierDot({ tier, className }: { tier: KasperskyTier; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx("inline-block h-2.5 w-2.5 flex-none rounded-full", TIER_ACCENTS[tier], className)}
    />
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "muted";
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={clsx(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
          tone === "muted" && "text-zinc-500 dark:text-zinc-400",
          tone === "neutral" && "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
      {description ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePage(value: string | string[] | undefined) {
  const page = Number(firstParam(value) ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.min(Math.trunc(page), 10_000) : 1;
}

const EVENT_LABELS: Record<string, string> = {
  CODES_IMPORTED: "Codes importés",
  CODE_REVOKED: "Code retiré",
  ORDER_CREATED: "Licence créée (codes réservés)",
  PDF_GENERATED: "PDF généré (codes utilisés)",
  PDF_DOWNLOADED: "PDF re-téléchargé",
  PDF_FAILED: "Échec de génération du PDF",
  ORDER_CANCELLED: "Licence annulée",
  DELIVERED: "Livrée au client (facture + e-mail)",
};

export function eventLabel(type: string) {
  return EVENT_LABELS[type] ?? type;
}

export function actorLabel(actor: string | null, actorName?: string | null) {
  if (!actor) return "Système";
  if (actor.startsWith("user:")) return actorName || "Utilisateur";
  if (actor.startsWith("api:")) return `API (${actor.slice(4)})`;
  return actor;
}
