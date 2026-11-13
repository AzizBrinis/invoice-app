"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { useToast } from "@/components/ui/toast-provider";
import {
  cancelScheduledEmailAction,
  rescheduleScheduledEmailAction,
} from "@/app/(app)/messagerie/actions";
import type { ScheduledEmailSummary } from "@/server/messaging-scheduled";

type ScheduledEmailsClientProps = {
  items: ScheduledEmailSummary[];
};

const STATUS_LABELS: Record<string, { label: string; variant: BadgeProps["variant"] }> =
  {
    PENDING: { label: "Planifié", variant: "neutral" },
    SENDING: { label: "Envoi en cours", variant: "warning" },
    FAILED: { label: "Échec", variant: "danger" },
    CANCELLED: { label: "Annulé", variant: "neutral" },
  };

const subscribeToTimezone = () => () => {};
const getLocalTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimezone = () => DEFAULT_TIMEZONE;

function formatDate(date: string, timeZone: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

function toLocalInputValue(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = parsed.getFullYear();
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hours = pad(parsed.getHours());
  const minutes = pad(parsed.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function ScheduledEmailsClient({ items }: ScheduledEmailsClientProps) {
  const timeZone = useSyncExternalStore(subscribeToTimezone, getLocalTimezone, getServerTimezone);
  const [refreshing, startRefresh] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const { addToast } = useToast();
  const router = useRouter();

  const awaitingDelivery = items.some((entry) => entry.status === "PENDING" || entry.status === "SENDING");
  useEffect(() => {
    if (!awaitingDelivery || editingId || pendingActionId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [awaitingDelivery, editingId, pendingActionId, router]);

  const handleRefresh = () => startRefresh(() => router.refresh());

  const submitChange = async (id: string, sendAt?: Date) => {
    const formData = new FormData();
    formData.append("id", id);
    if (sendAt) {
      formData.append("scheduledAt", sendAt.toISOString());
    }
    setPendingActionId(id);
    try {
      const result = sendAt
        ? await rescheduleScheduledEmailAction(formData)
        : await cancelScheduledEmailAction(formData);
      if (result.success) {
        setEditingId(null);
      } else {
        handleRefresh();
      }
      addToast({
        variant: result.success ? "success" : "error",
        title: result.message ?? "Planification mise à jour.",
      });
    } catch {
      handleRefresh();
      addToast({ variant: "error", title: "Impossible de confirmer la modification." });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleReschedule = async () => {
    if (!editingId || !editingValue.trim().length) {
      addToast({
        variant: "error",
        title: "Sélectionnez une nouvelle date.",
      });
      return;
    }
    const parsed = new Date(editingValue);
    if (Number.isNaN(parsed.getTime())) {
      addToast({
        variant: "error",
        title: "Date invalide.",
      });
      return;
    }
    await submitChange(editingId, parsed);
  };

  const handleCancel = async (id: string) => {
    if (window.confirm("Annuler cet e-mail planifié ?")) {
      await submitChange(id);
    }
  };

  const refreshButton = (
    <Button type="button" variant="secondary" loading={refreshing} onClick={handleRefresh}>
      <RefreshCw className="mr-2 h-4 w-4" />
      Actualiser
    </Button>
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <CalendarClock className="mx-auto h-12 w-12 text-zinc-400" />
        <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Aucun envoi planifié
        </h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Utilisez le bouton &quot;Planifier l&apos;envoi&quot; depuis le composeur pour préparer vos prochains e-mails.
        </p>
        <div className="mt-4">{refreshButton}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{refreshButton}</div>
      {items.map((entry) => {
        const statusMeta = STATUS_LABELS[entry.status] ?? {
          label: entry.status,
          variant: "neutral" as const,
        };
        const canChange = entry.status === "PENDING" || entry.status === "FAILED";
        const isEditing = canChange && editingId === entry.id;
        const isPending = pendingActionId === entry.id;
        return (
          <div
            key={entry.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {formatDate(entry.sendAt, timeZone)}
                </p>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {entry.subject || "(Sans objet)"}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  À : {entry.to.join(", ") || "—"}
                </p>
                {entry.cc.length ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Cc : {entry.cc.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-start gap-2">
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                {entry.failureReason ? (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {entry.failureReason}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              {entry.previewText || "Aucun aperçu disponible."}
            </p>
            {isEditing ? (
              <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <label
                  htmlFor={`reschedule-${entry.id}`}
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Nouvelle date
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id={`reschedule-${entry.id}`}
                    type="datetime-local"
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      disabled={pendingActionId !== null}
                      className="w-full sm:w-auto"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      onClick={handleReschedule}
                      loading={isPending}
                      disabled={pendingActionId !== null}
                      className="w-full sm:w-auto"
                    >
                      Replanifier
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {canChange && !isEditing ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full px-3 py-1.5 text-sm sm:w-auto"
                  onClick={() => {
                    setEditingId(entry.id);
                    setEditingValue(toLocalInputValue(entry.sendAt));
                  }}
                  disabled={pendingActionId !== null}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full px-3 py-1.5 text-sm sm:w-auto"
                  onClick={() => handleCancel(entry.id)}
                  disabled={pendingActionId !== null}
                >
                  Annuler
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
