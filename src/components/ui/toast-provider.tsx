"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clsx } from "clsx";

type ToastVariant = "success" | "warning" | "error";

export type Toast = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
};

type ToastContextValue = {
  addToast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(
  undefined,
);

const variantStyles: Record<
  ToastVariant,
  { container: string; description: string }
> = {
  success: {
    container:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-50",
    description:
      "text-emerald-700 dark:text-emerald-100",
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-50",
    description:
      "text-amber-700 dark:text-amber-100",
  },
  error: {
    container:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/20 dark:text-red-50",
    description:
      "text-red-700 dark:text-red-100",
  },
};

let toastIdCounter = 0;

const generateToastId = () => {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}`;
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(
      () => onDismiss(toast.id),
      toast.duration ?? 5000,
    );
    return () => {
      window.clearTimeout(timeout);
    };
  }, [onDismiss, toast.duration, toast.id]);

  return (
    <div
      className={clsx(
        "rounded-lg border px-4 py-3 shadow-lg backdrop-blur transition-opacity",
        variantStyles[toast.variant].container,
      )}
      role="status"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description ? (
          <p
            className={clsx(
              "text-xs",
              variantStyles[toast.variant].description,
            )}
          >
            {toast.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = generateToastId();
      setToasts((current) => [
        ...current,
        {
          id,
          ...toast,
        },
      ]);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      addToast,
    }),
    [addToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 sm:items-end sm:pr-4">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
