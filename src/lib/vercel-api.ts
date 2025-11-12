type VercelConfig = {
  projectId: string;
  token: string;
  teamId?: string;
};

const VERCEL_API_BASE_URL = "https://api.vercel.com";

export class MissingVercelConfigError extends Error {
  constructor(
    message = "Configurez VERCEL_PROJECT_ID et VERCEL_TOKEN pour gérer les domaines personnalisés.",
  ) {
    super(message);
    this.name = "MissingVercelConfigError";
  }
}

type VercelApiErrorOptions = {
  status: number;
  code?: string;
  requestId?: string;
  body?: unknown;
  cause?: unknown;
};

export class VercelApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly body?: unknown;

  constructor(message: string, options: VercelApiErrorOptions) {
    super(message);
    this.name = "VercelApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.body = options.body;
    if (options.cause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).cause = options.cause;
    }
  }
}

function readVercelConfig(): VercelConfig | null {
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const token =
    process.env.VERCEL_TOKEN?.trim() ??
    process.env.VERCEL_ACCESS_TOKEN?.trim() ??
    process.env.VERCEL_AUTH_TOKEN?.trim() ??
    null;
  if (!projectId || !token) {
    return null;
  }
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  return {
    projectId,
    token,
    teamId: teamId || undefined,
  };
}

function requireVercelConfig(): VercelConfig {
  const config = readVercelConfig();
  if (!config) {
    throw new MissingVercelConfigError();
  }
  return config;
}

function buildVercelUrl(path: string, config: VercelConfig) {
  const url = new URL(path, VERCEL_API_BASE_URL);
  if (config.teamId) {
    url.searchParams.set("teamId", config.teamId);
  }
  return url;
}

async function callVercelApi<T>(
  path: string,
  init: RequestInit | undefined,
  config: VercelConfig,
): Promise<T> {
  const url = buildVercelUrl(path, config);
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${config.token}`);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new VercelApiError("Impossible de contacter l’API Vercel.", {
      status: 0,
      cause: error,
    });
  }

  const requestId = response.headers.get("x-vercel-id") ?? undefined;
  const rawBody = await response.text();
  let parsedBody: unknown = undefined;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    const message =
      typeof parsedBody === "object" &&
      parsedBody !== null &&
      "error" in parsedBody
        ? ((parsedBody as { error?: { message?: string } }).error?.message ??
          `Requête Vercel échouée (HTTP ${response.status}).`)
        : typeof parsedBody === "string" && parsedBody.length > 0
          ? parsedBody
          : `Requête Vercel échouée (HTTP ${response.status}).`;
    const code =
      typeof parsedBody === "object" &&
      parsedBody !== null &&
      "error" in parsedBody
        ? (parsedBody as { error?: { code?: string } }).error?.code
        : undefined;
    throw new VercelApiError(message, {
      status: response.status,
      code,
      requestId,
      body: parsedBody,
    });
  }

  return parsedBody as T;
}

export async function ensureVercelProjectDomain(domain: string) {
  const config = requireVercelConfig();
  try {
    await callVercelApi(
      `/v9/projects/${config.projectId}/domains`,
      {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      },
      config,
    );
  } catch (error) {
    if (
      error instanceof VercelApiError &&
      error.status === 409 &&
      error.code === "domain_already_exists"
    ) {
      return;
    }
    throw error;
  }
}

export async function removeVercelProjectDomain(domain: string) {
  const config = readVercelConfig();
  if (!config) {
    return;
  }
  try {
    await callVercelApi(
      `/v9/projects/${config.projectId}/domains/${domain}`,
      { method: "DELETE" },
      config,
    );
  } catch (error) {
    if (
      error instanceof VercelApiError &&
      (error.status === 404 || error.code === "domain_not_found")
    ) {
      return;
    }
    throw error;
  }
}
