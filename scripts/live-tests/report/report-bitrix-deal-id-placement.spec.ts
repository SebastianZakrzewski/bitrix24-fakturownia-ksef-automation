import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import { runBackendTriggerPreflight } from '../trigger-preflight/run-backend-trigger-preflight';
import { buildLiveTestReport } from './build-live-test-report';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import type { LiveTestReport } from '../types/live-test-report.types';
import {
  assertBitrixDealIdOnlyInApprovedReportFields,
  redactMarkdownForRealDataMarkerCheck,
} from './report-bitrix-deal-id-placement';
import {
  assertDryRunReport,
  DryRunReportAssertionError,
} from './assert-dry-run-report';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
};

describe('report-bitrix-deal-id-placement', () => {
  it('allows example deal id only in approved preflight fields', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const preflight = runBackendTriggerPreflight(
      contract,
      {
        baseUrl: 'http://localhost:3000',
        triggerPath: '/invoice-processes/bitrix-trigger',
        authHeaderName: 'x-api-key',
        authSecret: 'dummy-local-secret',
      },
      fullInvoiceDryRunContext,
      {
        LIVE_TEST_ACTUAL_BITRIX_DEAL_ID: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
        LIVE_TEST_DEAL_LABEL: '[TEST] Runner FULL smoke test 001',
        LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED: 'false',
      },
    );

    expect(preflight.liveSmokeTarget.actualBitrixDealId).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(preflight.request.payload.bitrix_deal_id).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(preflight.liveSmokeTarget.testDealLabelStartsWithTestPrefix).toBe(true);
    expect(preflight.liveSmokeTarget.manualCrmPreparationConfirmed).toBe(false);
    expect(preflight.execution.requestSent).toBe(false);
    expect(preflight.execution.endpointCalled).toBe(false);
    expect(preflight.execution.workflowExecuted).toBe(false);
    expect(preflight.execution.dbWriteExecuted).toBe(false);

    const report: LiveTestReport = {
      mode: 'DRY_RUN',
      meta: {
        scenarioId: 'full',
        invoiceType: 'FULL',
        runnerVersion: 'test',
        startedAt: '2026-05-26T12:00:00.000Z',
        finishedAt: '2026-05-26T12:00:01.000Z',
      },
      safety: { passed: true, checks: [] },
      productionReadiness: 'NOT_READY',
      ksefStatus: 'MANUAL_REQUIRED',
      bitrixSyncStatus: 'NOT_TESTED_YET',
      externalSideEffectsExecuted: false,
      backendAvailabilitySmoke: {
        mode: 'CONTROLLED_BACKEND_SMOKE',
        smokeKind: 'BACKEND_AVAILABILITY',
        target: {
          method: 'GET',
          path: '/health',
          baseUrlConfigured: false,
          endpointCalled: false,
        },
        request: { timeoutMs: 5000 },
        resultStatus: 'BACKEND_HEALTH_NOT_CONFIGURED',
        externalSideEffectsExecuted: false,
        workflowExecuted: false,
        invoiceProcessCreated: false,
        invoiceRecordCreated: false,
        dbWriteExecuted: false,
        bitrixCalled: false,
        fakturowniaCalled: false,
        ksefTested: false,
        warnings: [],
        errors: [],
      },
      backendSmokeReadiness: {
        mode: 'DRY_RUN',
        readinessKind: 'BACKEND_SMOKE_READINESS',
        scenarioType: 'FULL',
        target: {
          endpointName: 'BITRIX_TRIGGER',
          method: 'POST',
          path: '/invoice-processes/bitrix-trigger',
          baseUrlConfigured: true,
          endpointCallAllowed: false,
          endpointCalled: false,
        },
        auth: {
          required: true,
          headerNameConfigured: true,
          secretConfigured: true,
          secretDisplayed: false,
        },
        contract: {
          compatibleWithBitrixTriggerRequestDto: true,
          contractValidationStatus: 'PASSED',
        },
        executionPolicy: {
          backendEndpointAllowed: false,
          useCaseExecutionAllowed: false,
          dbWriteAllowed: false,
          externalSideEffectsAllowed: false,
        },
        readinessStatus: 'NOT_READY_FOR_BACKEND_SMOKE',
        blockers: [],
        warnings: [],
      },
      backendTriggerPreflight: {
        mode: 'CONTROLLED_BACKEND_PREFLIGHT',
        preflightKind: 'BACKEND_TRIGGER_PREFLIGHT',
        scenarioType: 'FULL',
        target: {
          method: 'POST',
          path: '/invoice-processes/bitrix-trigger',
          baseUrlConfigured: true,
          authHeaderNameConfigured: true,
          authSecretConfigured: true,
          secretDisplayed: false,
        },
        request: {
          payloadShapeValid: true,
          bitrix_deal_id: preflight.request.payload.bitrix_deal_id,
          trigger_source: 'BITRIX24_STAGE_CHANGE',
          trigger_stage_id: preflight.request.payload.trigger_stage_id,
          triggered_at: preflight.request.payload.triggered_at,
        },
        executionPolicy: {
          triggerExecutionAllowed: false,
          backendEndpointAllowed: false,
          useCaseExecutionAllowed: false,
          dbWriteAllowed: false,
          externalSideEffectsAllowed: false,
        },
        execution: preflight.execution,
        liveSmokeTarget: preflight.liveSmokeTarget,
        preflightStatus: preflight.preflightStatus,
        blockers: [],
        warnings: [],
      },
      backendContract: {
        mode: 'DRY_RUN',
        scenarioType: 'FULL',
        expectedInvoiceType: 'FULL',
        trigger: {
          bitrix_deal_id: '[TEST]-FULL-001',
          trigger_source: 'BITRIX24_STAGE_CHANGE',
          trigger_stage_id: 'PREPARATION',
          triggered_at: '2026-05-26T12:00:00.000Z',
        },
        executionPolicy: {
          backendEndpointAllowed: false,
          useCaseExecutionAllowed: false,
          dbWriteAllowed: false,
          externalSideEffectsAllowed: false,
        },
        contractValidationStatus: 'PASSED',
      },
      backendDryRun: {
        backendMode: 'DRY_RUN',
        backendWorkflowExecuted: false,
        backendEndpointCalled: false,
        useCaseExecuted: false,
        invoiceProcessCreated: false,
        invoiceRecordCreated: false,
        invoiceEventCreated: false,
        dbWriteExecuted: false,
        validationSimulated: true,
        mappedFromFixture: true,
        resultStatus: 'BACKEND_DRY_RUN_SIMULATED',
        scenarioType: 'FULL',
        expectedInvoiceType: 'FULL',
        testContextId: 'test-context-full-001',
        bitrixDealId: '[TEST]-FULL-001',
        notes: ['simulated'],
      },
      fixture: {
        testContextId: 'test-context-full-001',
        scenarioType: 'FULL',
        bitrixDealId: '[TEST]-FULL-001',
        expectedInvoiceType: 'FULL',
        paidStageId: 'PREPARATION',
        buyerSummary: {
          companyName: '[TEST] Demo',
          nipMasked: 'TEST-****',
          city: 'Warszawa',
          country: 'PL',
        },
        productSummary: [],
        expectedExternalStepsSkipped: [],
      },
      integrations: {
        ksef: 'MANUAL_REQUIRED',
        bitrixSync: 'NOT_TESTED_YET',
        bitrixDealSetup: 'SKIPPED_NOT_EXECUTED',
        backendWorkflow: 'BACKEND_DRY_RUN_SIMULATED',
        fakturowniaOrder: 'SKIPPED_NOT_EXECUTED',
        fakturowniaInvoice: 'SKIPPED_NOT_EXECUTED',
        database: 'SKIPPED_NOT_EXECUTED',
      },
      scenario: {
        id: 'full',
        invoiceType: 'FULL',
        status: 'DRY_RUN_COMPLETED',
        steps: [],
      },
      summary: 'Dry-run only',
    };

    expect(() => assertBitrixDealIdOnlyInApprovedReportFields(report)).not.toThrow();
  });

  it('rejects example deal id leaked into summary text', async () => {
    const scenarioResult = await fullInvoiceScenario.run();
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, fullInvoiceScenario.safetyContext),
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      finishedAt: new Date('2026-05-26T12:00:01.000Z'),
      reportWritten: true,
      smokeReadinessConfig: {},
    });

    const leaked: LiveTestReport = {
      ...report,
      backendTriggerPreflight: {
        ...report.backendTriggerPreflight,
        liveSmokeTarget: {
          ...report.backendTriggerPreflight.liveSmokeTarget,
          actualBitrixDealId: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
        },
        request: {
          ...report.backendTriggerPreflight.request,
          bitrix_deal_id: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
        },
      },
      summary: `Deal ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID} prepared for smoke`,
    };

    expect(() => assertBitrixDealIdOnlyInApprovedReportFields(leaked)).toThrow(
      /outside approved report fields/,
    );
    expect(() => assertDryRunReport(leaked, 'full')).toThrow(DryRunReportAssertionError);
  });

  it('redacts approved deal ids from markdown before forbidden marker scan', () => {
    const markdown = `Actual Bitrix deal ID: **${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}**`;
    const report = {
      backendTriggerPreflight: {
        liveSmokeTarget: { actualBitrixDealId: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID },
        request: { bitrix_deal_id: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID },
      },
    } as LiveTestReport;

    const redacted = redactMarkdownForRealDataMarkerCheck(markdown, report);
    expect(redacted).not.toContain(LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID);
    expect(redacted).toContain('[CONFIGURED_BITRIX_DEAL_ID]');
  });
});
