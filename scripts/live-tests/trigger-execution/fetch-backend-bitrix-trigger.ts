import { BACKEND_TRIGGER_EXECUTION_METHOD } from './backend-trigger-execution.types';
import type { BitrixTriggerExecutionPayload } from './backend-trigger-execution.types';
import {
  assertTriggerExecutionPathAllowed,
  type BackendTriggerExecutionConfig,
} from './backend-trigger-execution-config';

export class BackendTriggerFetchTimeoutError extends Error {
  constructor(message = 'Backend trigger request timed out') {
    super(message);
    this.name = 'BackendTriggerFetchTimeoutError';
  }
}

export type BackendTriggerFetchImpl = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;

export interface FetchBackendBitrixTriggerInput {
  config: BackendTriggerExecutionConfig;
  payload: BitrixTriggerExecutionPayload;
  fetchImpl?: BackendTriggerFetchImpl;
}

export interface FetchBackendBitrixTriggerResponse {
  statusCode: number;
  ok: boolean;
  requestUrl: string;
  bodyText: string;
}

function resolveTriggerUrl(config: BackendTriggerExecutionConfig): string {
  if (!config.baseUrl) {
    throw new Error('LIVE_TEST_BACKEND_BASE_URL is required for trigger execution');
  }

  assertTriggerExecutionPathAllowed(config.triggerPath);
  return new URL(config.triggerPath!, config.baseUrl).toString();
}

function buildAuthHeaders(
  config: BackendTriggerExecutionConfig,
): Record<string, string> {
  if (!config.authHeaderName || !config.authSecret) {
    throw new Error('Backend trigger auth header and secret must be configured');
  }

  return {
    [config.authHeaderName]: config.authSecret,
    'content-type': 'application/json',
    accept: 'application/json',
  };
}

/**
 * Sends exactly one POST to /invoice-processes/bitrix-trigger. Caller must enforce gate first.
 */
export async function fetchBackendBitrixTrigger(
  input: FetchBackendBitrixTriggerInput,
): Promise<FetchBackendBitrixTriggerResponse> {
  const fetchFn = input.fetchImpl ?? fetch;
  const requestUrl = resolveTriggerUrl(input.config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);

  try {
    const response = await fetchFn(requestUrl, {
      method: BACKEND_TRIGGER_EXECUTION_METHOD,
      headers: buildAuthHeaders(input.config),
      body: JSON.stringify(input.payload),
      signal: controller.signal,
    });

    const bodyText = await response.text();

    return {
      statusCode: response.status,
      ok: response.ok,
      requestUrl,
      bodyText,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new BackendTriggerFetchTimeoutError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
