/**
 * Centralised API client.
 *
 * Every network call in the app goes through `request`. Endpoint paths live in
 * `endpoints` only — never inline a URL inside a component.
 *
 * Mock fixtures are used only when VITE_API_BASE_URL is unset, or when a GET
 * request cannot reach the backend. Writes (POST/PATCH/DELETE) never fall back
 * to mock data: if they fail you get a real error.
 */

export const API_BASE_URL: string =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000";

export const USE_MOCK_TRANSPORT =
  !(import.meta.env["VITE_API_BASE_URL"] as string | undefined);

export const endpoints = {
  dashboard: "/api/dashboard",
  documents: "/api/documents",
  documentUpload: "/api/documents/upload",
  document: (id: string) => `/api/documents/${id}`,
  documentReindex: (id: string) => `/api/documents/${id}/reindex`,
  ragConfigurations: "/api/rag/configurations",
  ragQuery: "/api/rag/query",
  evaluations: "/api/evaluations",
  evaluationRun: "/api/evaluations/run",
  evaluation: (id: string) => `/api/evaluations/${id}`,
  evaluationResults: (id: string) => `/api/evaluations/${id}/results`,
  experiments: "/api/experiments",
  experimentsCompare: "/api/experiments/compare",
  failures: "/api/failures",
  recommendations: "/api/recommendations",
  datasets: "/api/datasets",
  models: "/api/models",
  settings: "/api/settings",
  health: "/api/health",
} as const;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions<TMock> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Fixture returned while the backend is not connected. */
  mock: TMock | (() => TMock);
  /** Simulated network delay for mock transport, in ms. */
  mockDelayMs?: number;
  signal?: AbortSignal;
}

const resolveMock = <T>(mock: T | (() => T)): T =>
  typeof mock === "function" ? (mock as () => T)() : mock;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildUrl(path: string, query?: RequestOptions<unknown>["query"]) {
  const url = new URL(path, API_BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function request<TMock>(
  path: string,
  options: RequestOptions<TMock>,
): Promise<TMock> {
  const method = options.method ?? "GET";

  if (USE_MOCK_TRANSPORT) {
    await delay(options.mockDelayMs ?? 260);
    return resolveMock(options.mock);
  }

  try {
    const hasBody = options.body !== undefined && options.body !== null;
    const response = await fetch(buildUrl(path, options.query), {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : {},
      body: hasBody ? JSON.stringify(options.body) : null,
      signal: options.signal ?? null,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const detail =
        errorBody && typeof errorBody.detail === "string"
          ? errorBody.detail
          : response.statusText || `Request failed (${response.status})`;
      throw new ApiError(detail, response.status, path);
    }
    return (await response.json()) as TMock;
  } catch (err) {
    // A real HTTP error from the backend: show it.
    if (err instanceof ApiError) {
      throw err;
    }

    // Writes must never pretend to succeed.
    if (method !== "GET") {
      console.error(`[apiClient] ${method} ${path} failed`, err);
      throw new ApiError(
        "Cannot reach the backend. Check that it is running and that CORS allows this origin.",
        0,
        path,
      );
    }

    // Reads fall back to the mock fixture so the UI still renders.
    console.warn(
      `[apiClient] Backend at ${API_BASE_URL}${path} unreachable. Falling back to mock fixture.`,
      err,
    );
    await delay(options.mockDelayMs ?? 180);
    return resolveMock(options.mock);
  }
}

export const apiClient = { request, endpoints, API_BASE_URL, USE_MOCK_TRANSPORT };