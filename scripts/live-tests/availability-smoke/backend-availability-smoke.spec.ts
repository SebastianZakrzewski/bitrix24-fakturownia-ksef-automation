import { readFileSync } from 'fs';
import { join } from 'path';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { assertDryRunReport } from '../report/assert-dry-run-report';
import { buildLiveTestReportMarkdown } from '../report/report-writer';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import {
  FORBIDDEN_BACKEND_SMOKE_PATH,
  type BackendHealthFetchImpl,
  fetchBackendHealth,
} from './fetch-backend-health';
import { parseBackendAvailabilitySmokeConfig } from './backend-availability-smoke-config';
import { runBackendAvailabilitySmoke } from './run-backend-availability-smoke';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
  LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: false,
};

const configuredAvailability = {
  baseUrl: 'http://localhost:3000',
  healthPath: '/health',
  timeoutMs: 5000,
};

function createFetchMock(
  handler: BackendHealthFetchImpl,
): jest.MockedFunction<BackendHealthFetchImpl> {
  return jest.fn(handler);
}

describe('runBackendAvailabilitySmoke', () => {
  it('missing backend base URL does not call backend and returns NOT_CONFIGURED', async () => {
    const fetchMock = createFetchMock(async () => {
      throw new Error('fetch must not be called');
    });

    const result = await runBackendAvailabilitySmoke(
      { healthPath: '/health', timeoutMs: 5000 },
      { fetchImpl: fetchMock },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.resultStatus).toBe('BACKEND_HEALTH_NOT_CONFIGURED');
    expect(result.target.endpointCalled).toBe(false);
    expect(result.runnerDirectExternalSideEffectsExecuted).toBe(false);
    expect(result.workflowExecuted).toBe(false);
  });

  it('configured base URL calls only GET /health', async () => {
    const fetchMock = createFetchMock(async (_url, init) => {
      expect(init?.method).toBe('GET');
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    });

    const result = await runBackendAvailabilitySmoke(configuredAvailability, {
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('/health');
    expect(calledUrl).not.toContain(FORBIDDEN_BACKEND_SMOKE_PATH);
    expect(result.target.endpointCalled).toBe(true);
    expect(result.resultStatus).toBe('BACKEND_HEALTH_PASSED');
  });

  it('health 2xx returns BACKEND_HEALTH_PASSED', async () => {
    const result = await runBackendAvailabilitySmoke(configuredAvailability, {
      fetchImpl: createFetchMock(async () => new Response('ok', { status: 200 })),
    });

    expect(result.resultStatus).toBe('BACKEND_HEALTH_PASSED');
    expect(result.response?.statusCode).toBe(200);
    expect(result.response?.ok).toBe(true);
  });

  it('health non-2xx returns BACKEND_HEALTH_FAILED', async () => {
    const result = await runBackendAvailabilitySmoke(configuredAvailability, {
      fetchImpl: createFetchMock(async () => new Response('error', { status: 503 })),
    });

    expect(result.resultStatus).toBe('BACKEND_HEALTH_FAILED');
    expect(result.response?.statusCode).toBe(503);
  });

  it('timeout returns BACKEND_HEALTH_TIMEOUT', async () => {
    const fetchMock = createFetchMock((_url, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const result = await runBackendAvailabilitySmoke(
      { ...configuredAvailability, timeoutMs: 10 },
      { fetchImpl: fetchMock },
    );

    expect(result.resultStatus).toBe('BACKEND_HEALTH_TIMEOUT');
    expect(result.target.endpointCalled).toBe(true);
  });

  it('never issues POST or calls invoice trigger path', async () => {
    const fetchMock = createFetchMock(async (url, init) => {
      expect(init?.method).not.toBe('POST');
      expect(String(url)).not.toContain('/invoice-processes/bitrix-trigger');
      return new Response('ok', { status: 200 });
    });

    await runBackendAvailabilitySmoke(configuredAvailability, { fetchImpl: fetchMock });
    await expect(
      fetchBackendHealth({
        baseUrl: configuredAvailability.baseUrl!,
        healthPath: FORBIDDEN_BACKEND_SMOKE_PATH,
        timeoutMs: 1000,
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(/invoice trigger/i);
  });

  it('result always keeps workflow and external safety flags false', async () => {
    const result = await runBackendAvailabilitySmoke(configuredAvailability, {
      fetchImpl: createFetchMock(async () => new Response('ok', { status: 200 })),
    });

    expect(result.runnerDirectExternalSideEffectsExecuted).toBe(false);
    expect(result.workflowExecuted).toBe(false);
    expect(result.dbWriteExecuted).toBe(false);
    expect(result.bitrixCalled).toBe(false);
    expect(result.fakturowniaCalled).toBe(false);
    expect(result.ksefTested).toBe(false);
    expect(result.invoiceProcessCreated).toBe(false);
    expect(result.invoiceRecordCreated).toBe(false);
  });

  it('reports include backendAvailabilitySmoke and strict assertions pass', async () => {
    const scenario = fullInvoiceScenario;
    const scenarioResult = await executeDryRunScenario({
      context: fullInvoiceDryRunContext,
      availabilityConfig: configuredAvailability,
      fetchImpl: createFetchMock(async () => new Response('ok', { status: 200 })),
    });

    const report = buildLiveTestReport({
      scenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, scenario.safetyContext),
      startedAt: new Date(),
      finishedAt: new Date(),
      reportWritten: true,
      smokeReadinessConfig: {},
    });

    const json = JSON.stringify(report);
    const markdown = buildLiveTestReportMarkdown(report);

    expect(report.backendAvailabilitySmoke.smokeKind).toBe('BACKEND_AVAILABILITY');
    expect(json).not.toContain('dummy-local-secret');
    expect(markdown).toContain('## Backend availability smoke');
    expect(() => assertDryRunReport(report, 'full')).not.toThrow();
  });

  it('availability module does not import forbidden backend modules', () => {
    const files = [
      'backend-availability-smoke.types.ts',
      'backend-availability-smoke-config.ts',
      'fetch-backend-health.ts',
      'run-backend-availability-smoke.ts',
    ];
    const forbidden = [
      /modules\/invoices\/use-cases/i,
      /\/repositories\//i,
      /\bfrom\s+['"][^'"]*\/src\//,
      /\bCreateInvoiceFromBitrixDealUseCase\b/,
    ];

    for (const file of files) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      const importLines = source
        .split('\n')
        .filter((line) => /^\s*import\s+/.test(line));

      for (const line of importLines) {
        for (const pattern of forbidden) {
          expect(line).not.toMatch(pattern);
        }
      }
    }
  });
});

describe('parseBackendAvailabilitySmokeConfig', () => {
  it('defaults health path and timeout from env', () => {
    const config = parseBackendAvailabilitySmokeConfig({
      LIVE_TEST_BACKEND_HEALTH_PATH: '/health',
      LIVE_TEST_BACKEND_REQUEST_TIMEOUT_MS: '3000',
    });

    expect(config.healthPath).toBe('/health');
    expect(config.timeoutMs).toBe(3000);
  });
});
