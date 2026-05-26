import { BACKEND_HEALTH_SMOKE_METHOD } from './backend-availability-smoke.types';

export const FORBIDDEN_BACKEND_SMOKE_PATH = '/invoice-processes/bitrix-trigger';

export class BackendHealthFetchTimeoutError extends Error {
  constructor(message = 'Backend health request timed out') {
    super(message);
    this.name = 'BackendHealthFetchTimeoutError';
  }
}

export type BackendHealthFetchImpl = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export interface FetchBackendHealthInput {
  baseUrl: string;
  healthPath: string;
  timeoutMs: number;
  fetchImpl?: BackendHealthFetchImpl;
}

export interface FetchBackendHealthResponse {
  statusCode: number;
  ok: boolean;
  requestUrl: string;
}

function resolveHealthUrl(baseUrl: string, healthPath: string): string {
  if (healthPath === FORBIDDEN_BACKEND_SMOKE_PATH) {
    throw new Error('Health smoke must not call invoice trigger endpoint');
  }

  if (healthPath !== '/health') {
    throw new Error('Health smoke path must be /health');
  }

  return new URL(healthPath, baseUrl).toString();
}

/**
 * Performs a single GET health request. No auth headers by default (health is public in V1).
 */
export async function fetchBackendHealth(
  input: FetchBackendHealthInput,
): Promise<FetchBackendHealthResponse> {
  const fetchFn = input.fetchImpl ?? fetch;
  const requestUrl = resolveHealthUrl(input.baseUrl, input.healthPath);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetchFn(requestUrl, {
      method: BACKEND_HEALTH_SMOKE_METHOD,
      signal: controller.signal,
    });

    return {
      statusCode: response.status,
      ok: response.ok,
      requestUrl,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BackendHealthFetchTimeoutError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
