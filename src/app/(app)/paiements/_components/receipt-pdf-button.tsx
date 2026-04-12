"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";

type ReceiptPdfButtonProps = {
  paymentId: string;
  label?: string;
  loadingLabel?: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
};

const RECEIPT_GENERATION_TIMEOUT_MS = 45000;

function getReceiptUrl(paymentId: string) {
  return `/api/clients/payments/${encodeURIComponent(paymentId)}/receipt`;
}

async function readErrorMessage(response: Response) {
  const fallback = "Impossible de générer le reçu.";
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { message?: unknown };
      return typeof payload.message === "string" && payload.message.trim()
        ? payload.message
        : fallback;
    }

    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

function writePopupStatus(popup: Window | null, message: string) {
  if (!popup) {
    return;
  }

  try {
    popup.opener = null;
    popup.document.title = "Génération du reçu";
    popup.document.body.innerHTML = "";
    const status = popup.document.createElement("p");
    status.textContent = message;
    status.style.fontFamily =
      "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    status.style.margin = "24px";
    popup.document.body.append(status);
  } catch {
    // The PDF flow still works if the browser blocks access to the popup.
  }
}

export function ReceiptPdfButton({
  paymentId,
  label = "Reçu PDF",
  loadingLabel = "Génération...",
  className,
  variant = "ghost",
}: ReceiptPdfButtonProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const receiptUrl = useMemo(() => getReceiptUrl(paymentId), [paymentId]);

  async function handleGenerateReceipt() {
    if (loading) {
      return;
    }

    setLoading(true);
    setStatusMessage("Génération du reçu en cours...");
    const popup = window.open("", "_blank");
    writePopupStatus(popup, "Génération du reçu en cours...");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
    }, RECEIPT_GENERATION_TIMEOUT_MS);

    try {
      const response = await fetch(receiptUrl, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("Le PDF généré est vide.");
      }

      const objectUrl = URL.createObjectURL(blob);
      let openedPdf = false;
      if (popup && !popup.closed) {
        popup.location.href = objectUrl;
        openedPdf = true;
      } else {
        openedPdf = Boolean(
          window.open(objectUrl, "_blank", "noopener,noreferrer"),
        );
      }

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 120000);

      setStatusMessage("Reçu généré.");
      if (openedPdf) {
        addToast({
          variant: "success",
          title: "Reçu généré",
          description: "Le PDF est prêt dans un nouvel onglet.",
        });
      } else {
        setStatusMessage(
          "Reçu généré. Cliquez sur la notification pour ouvrir le PDF.",
        );
        addToast({
          variant: "warning",
          title: "Reçu généré",
          description:
            "Le navigateur a bloqué l'ouverture automatique. Cliquez ici pour ouvrir le PDF.",
          duration: 12000,
          onClick: () => {
            window.open(objectUrl, "_blank", "noopener,noreferrer");
          },
        });
      }
      router.refresh();
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "La génération du reçu a dépassé le délai attendu. Réessayez dans quelques instants."
          : error instanceof Error
            ? error.message
            : "Impossible de générer le reçu.";

      if (popup && !popup.closed) {
        writePopupStatus(popup, message);
      }

      setStatusMessage(message);
      addToast({
        variant: "error",
        title: "Reçu non généré",
        description: message,
        duration: 8000,
      });
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={variant}
        className={className}
        loading={loading}
        onClick={handleGenerateReceipt}
      >
        {loading ? loadingLabel : label}
      </Button>
      {statusMessage ? (
        <p
          className="text-xs text-zinc-500 dark:text-zinc-400"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
