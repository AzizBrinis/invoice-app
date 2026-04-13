"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { clsx } from "clsx";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type {
  ClientPickerOption,
  PaymentServicePickerOption,
} from "@/lib/client-payment-picker-types";

type PickerResponse<T> = {
  items?: T[];
  message?: string;
};

const SEARCH_LIMIT = 10;

function useOutsideClose(
  containerRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [containerRef, onClose]);
}

function useAsyncOptions<T>(endpoint: string, open: boolean, query: string) {
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);
  const fetchSequence = useRef(0);

  const loadOptions = useCallback(
    async (term: string) => {
      fetchController.current?.abort();
      const controller = new AbortController();
      fetchController.current = controller;
      fetchSequence.current += 1;
      const currentSequence = fetchSequence.current;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (term.trim()) {
          params.set("q", term.trim());
        }
        params.set("limit", String(SEARCH_LIMIT));
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as PickerResponse<T>;
          throw new Error(payload.message || "Impossible de charger les résultats.");
        }

        const payload = (await response.json()) as PickerResponse<T>;
        if (currentSequence === fetchSequence.current) {
          setOptions(payload.items ?? []);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        if (currentSequence === fetchSequence.current) {
          setOptions([]);
          setError(
            error instanceof Error
              ? error.message
              : "Impossible de charger les résultats.",
          );
        }
      } finally {
        if (currentSequence === fetchSequence.current) {
          setLoading(false);
        }
      }
    },
    [endpoint],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handle = window.setTimeout(() => {
      void loadOptions(query);
    }, 180);

    return () => {
      window.clearTimeout(handle);
    };
  }, [loadOptions, open, query]);

  useEffect(() => {
    return () => {
      fetchController.current?.abort();
    };
  }, []);

  return {
    error,
    loading,
    options,
  };
}

function getClientOptionLabel(option: ClientPickerOption) {
  return option.displayName;
}

function getClientOptionMeta(option: ClientPickerOption) {
  return [option.companyName, option.email].filter(Boolean).join(" · ");
}

type AsyncClientPickerProps = {
  id: string;
  name: string;
  initialSelection?: ClientPickerOption | null;
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  onSelectionChange?: (selection: ClientPickerOption | null) => void;
};

export function AsyncClientPicker({
  id,
  name,
  initialSelection = null,
  placeholder,
  emptyLabel,
  disabled = false,
  onSelectionChange,
}: AsyncClientPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ClientPickerOption | null>(
    initialSelection,
  );
  const [query, setQuery] = useState(
    initialSelection ? getClientOptionLabel(initialSelection) : "",
  );
  const { loading, options, error } = useAsyncOptions<ClientPickerOption>(
    "/api/clients/search",
    open && !disabled,
    query,
  );
  const visibleOptions = useMemo(
    () =>
      selected
        ? [
            selected,
            ...options.filter((option) => option.id !== selected.id),
          ]
        : options,
    [options, selected],
  );

  useOutsideClose(containerRef, () => setOpen(false));

  function handleSelection(option: ClientPickerOption) {
    setSelected(option);
    setQuery(getClientOptionLabel(option));
    setOpen(false);
    onSelectionChange?.(option);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <div className="relative">
        <Input
          id={id}
          type="search"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (
              selected &&
              event.target.value.trim() !== getClientOptionLabel(selected)
            ) {
              setSelected(null);
              onSelectionChange?.(null);
            }
          }}
        />
        {selected ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setOpen(true);
              onSelectionChange?.(null);
            }}
          >
            Effacer
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {!loading && !query.trim() && !visibleOptions.length ? (
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                  setOpen(false);
                  onSelectionChange?.(null);
                }}
              >
                <span>{emptyLabel}</span>
              </button>
            ) : null}

            {visibleOptions.map((option) => {
              const meta = getClientOptionMeta(option);
              const isSelected = option.id === selected?.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  className={clsx(
                    "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition",
                    isSelected
                      ? "bg-blue-50 text-blue-950 dark:bg-blue-500/15 dark:text-blue-50"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelection(option)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {option.displayName}
                    </span>
                    {meta ? (
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {meta}
                      </span>
                    ) : null}
                  </span>
                  {!option.isActive ? <Badge variant="neutral">Inactif</Badge> : null}
                </button>
              );
            })}

            {loading ? (
              <div className="px-3 py-2">
                <Spinner size="sm" label="Recherche..." />
              </div>
            ) : null}

            {!loading && !visibleOptions.length && query.trim() ? (
              <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                Aucun client trouvé.
              </p>
            ) : null}

            {error ? (
              <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type PaymentServiceMultiPickerProps = {
  name: string;
  currency: string;
  initialSelection?: PaymentServicePickerOption[];
  disabled?: boolean;
  onSelectionChange?: (selection: PaymentServicePickerOption[]) => void;
};

export function PaymentServiceMultiPicker({
  name,
  currency,
  initialSelection = [],
  disabled = false,
  onSelectionChange,
}: PaymentServiceMultiPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedOptions, setSelectedOptions] =
    useState<PaymentServicePickerOption[]>(initialSelection);
  const { loading, options, error } = useAsyncOptions<PaymentServicePickerOption>(
    "/api/clients/payment-services/search",
    open && !disabled,
    query,
  );
  const visibleOptions = useMemo(
    () =>
      options.filter(
        (option) =>
          !selectedOptions.some((selectedOption) => selectedOption.id === option.id),
      ),
    [options, selectedOptions],
  );

  useOutsideClose(containerRef, () => setOpen(false));

  function removeSelection(serviceId: string) {
    const next = selectedOptions.filter((option) => option.id !== serviceId);
    setSelectedOptions(next);
    onSelectionChange?.(next);
  }

  function addSelection(option: PaymentServicePickerOption) {
    if (selectedOptions.some((selectedOption) => selectedOption.id === option.id)) {
      return;
    }

    const next = [...selectedOptions, option];
    setSelectedOptions(next);
    onSelectionChange?.(next);
    setQuery("");
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {selectedOptions.length ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <span className="font-medium">{option.title}</span>
              <span>
                {formatCurrency(
                  fromCents(option.priceCents, currency),
                  currency,
                )}
              </span>
              {!option.isActive ? <Badge variant="neutral">Inactif</Badge> : null}
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                onClick={() => removeSelection(option.id)}
              >
                Retirer
              </button>
              <input type="hidden" name={name} value={option.id} />
            </span>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          Aucun service sélectionné. Le paiement doit être lié à au moins un
          service du catalogue.
        </p>
      )}

      <div className="relative">
        <Input
          type="search"
          autoComplete="off"
          value={query}
          placeholder="Rechercher un service a lier"
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
        />

        {open ? (
          <div className="absolute left-0 right-0 z-20 mt-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addSelection(option)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {option.title}
                    </span>
                    {option.details ? (
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {option.details}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {formatCurrency(
                        fromCents(option.priceCents, currency),
                        currency,
                      )}
                    </span>
                    {!option.isActive ? <Badge variant="neutral">Inactif</Badge> : null}
                  </span>
                </button>
              ))}

              {loading ? (
                <div className="px-3 py-2">
                  <Spinner size="sm" label="Recherche..." />
                </div>
              ) : null}

              {!loading && !visibleOptions.length ? (
                <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                  {query.trim()
                    ? "Aucun service trouvé."
                    : "Recherchez un service pour le lier au paiement."}
                </p>
              ) : null}

              {error ? (
                <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
