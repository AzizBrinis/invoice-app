"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface ExportButtonProps
  extends Omit<ButtonProps, "loading" | "onClick"> {
  href: string;
  method?: "GET" | "POST";
  loadingText?: ReactNode;
}

function resolveFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const extendedMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (extendedMatch?.[1]) {
    return decodeURIComponent(extendedMatch[1]);
  }

  const simpleMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);
  return simpleMatch?.[1] ?? null;
}

export function ExportButton({
  href,
  method = "GET",
  loadingText,
  children,
  ...props
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(href, {
        method,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Export échoué (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;

      const derivedName = resolveFileName(response.headers.get("Content-Disposition"));
      if (derivedName) {
        anchor.download = derivedName;
      }

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error(error);
      window.alert("Impossible de générer l'export pour le moment. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [href, method]);

  return (
    <Button
      {...props}
      type="button"
      loading={loading}
      onClick={handleClick}
    >
      {loading && loadingText ? loadingText : children}
    </Button>
  );
}
