type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;
type SearchParamSource = URLSearchParams | SearchParamRecord;

export type ClientPaymentFilters = {
  search: string;
  clientId: string | null;
  dateFromValue: string | null;
  dateToValue: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
};

export type ClientPaymentHrefFilters = {
  search?: string | null;
  clientId?: string | null;
  dateFromValue?: string | null;
  dateToValue?: string | null;
  page?: number | null;
};

function isUrlSearchParams(
  value: SearchParamSource,
): value is URLSearchParams {
  return value instanceof URLSearchParams;
}

export function readClientPaymentSearchParam(
  source: SearchParamSource,
  key: string,
) {
  if (isUrlSearchParams(source)) {
    return source.get(key) ?? undefined;
  }

  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseClientPaymentPageParam(source: SearchParamSource) {
  const parsed = Number.parseInt(
    readClientPaymentSearchParam(source, "page") ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseDateValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return {
      raw: null,
      date: null,
    };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) {
    return {
      raw: trimmed,
      date: null,
    };
  }

  return {
    raw: trimmed,
    date: parsed,
  };
}

export function parseClientPaymentFilters(
  source: SearchParamSource,
): ClientPaymentFilters {
  const search = readClientPaymentSearchParam(source, "recherche")?.trim() ?? "";
  const clientId =
    readClientPaymentSearchParam(source, "client")?.trim() || null;
  const dateFrom = parseDateValue(readClientPaymentSearchParam(source, "du"));
  const dateTo = parseDateValue(readClientPaymentSearchParam(source, "au"));

  return {
    search,
    clientId,
    dateFromValue: dateFrom.raw,
    dateToValue: dateTo.raw,
    dateFrom: dateFrom.date,
    dateTo: dateTo.date,
  };
}

export function buildClientPaymentQueryString(filters: {
  search?: string | null;
  clientId?: string | null;
  dateFromValue?: string | null;
  dateToValue?: string | null;
}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) {
    params.set("recherche", filters.search.trim());
  }
  if (filters.clientId?.trim()) {
    params.set("client", filters.clientId.trim());
  }
  if (filters.dateFromValue?.trim()) {
    params.set("du", filters.dateFromValue.trim());
  }
  if (filters.dateToValue?.trim()) {
    params.set("au", filters.dateToValue.trim());
  }
  return params.toString();
}

export function buildClientPaymentHref(
  filters: ClientPaymentHrefFilters,
  pathname: string = "/paiements",
) {
  const query = buildClientPaymentQueryString(filters);
  const params = new URLSearchParams(query);

  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  } else {
    params.delete("page");
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function buildClientPaymentHrefFromSearchParams(
  source: SearchParamSource,
  options: {
    pathname?: string;
    fallbackClientId?: string | null;
  } = {},
) {
  const filters = parseClientPaymentFilters(source);

  return buildClientPaymentHref(
    {
      ...filters,
      clientId: filters.clientId ?? options.fallbackClientId ?? null,
      page: parseClientPaymentPageParam(source),
    },
    options.pathname,
  );
}
