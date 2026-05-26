import { z } from 'zod';

export const LIVE_TEST_RUNNER_VERSION = '1.5.0-backend-smoke-readiness';

export const productionReadinessSchema = z.literal('NOT_READY');
export type ProductionReadiness = z.infer<typeof productionReadinessSchema>;

export const ksefTestStatusSchema = z.literal('MANUAL_REQUIRED');
export type KsefTestStatus = z.infer<typeof ksefTestStatusSchema>;

export const bitrixSyncTestStatusSchema = z.literal('NOT_TESTED_YET');
export type BitrixSyncTestStatus = z.infer<typeof bitrixSyncTestStatusSchema>;

export const integrationStepStatusSchema = z.enum([
  'NOT_RUN',
  'NOT_TESTED_YET',
  'MANUAL_REQUIRED',
  'SKIPPED',
  'SKIPPED_NOT_EXECUTED',
  'BACKEND_DRY_RUN_SIMULATED',
  'PASSED',
  'FAILED',
]);
export type IntegrationStepStatus = z.infer<typeof integrationStepStatusSchema>;

export const invoiceTypeSchema = z.enum(['FULL', 'ADVANCE', 'FINAL']);
export type LiveTestInvoiceType = z.infer<typeof invoiceTypeSchema>;

export const liveTestModeSchema = z.literal('DRY_RUN');
export type LiveTestMode = z.infer<typeof liveTestModeSchema>;

export const scenarioRunStatusSchema = z.enum([
  'PLACEHOLDER_SKIPPED',
  'DRY_RUN_COMPLETED',
  'PASSED',
  'FAILED',
]);
export type ScenarioRunStatus = z.infer<typeof scenarioRunStatusSchema>;

export const safetyCheckStatusSchema = z.enum(['passed', 'failed', 'skipped']);
export type SafetyCheckStatus = z.infer<typeof safetyCheckStatusSchema>;

export const safetyCheckSchema = z.object({
  code: z.string(),
  status: safetyCheckStatusSchema,
  message: z.string(),
});

export type SafetyCheck = z.infer<typeof safetyCheckSchema>;

export const scenarioStepSchema = z.object({
  name: z.string(),
  status: integrationStepStatusSchema,
  message: z.string().optional(),
});

export const fixtureBuyerSummarySchema = z.object({
  companyName: z.string(),
  nipMasked: z.string(),
  city: z.string(),
  country: z.string(),
});

export const fixtureProductSummarySchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPricePln: z.string(),
});

export const fixtureReportSummarySchema = z.object({
  testContextId: z.string(),
  scenarioType: invoiceTypeSchema,
  bitrixDealId: z.string(),
  expectedInvoiceType: invoiceTypeSchema,
  paidStageId: z.string(),
  buyerSummary: fixtureBuyerSummarySchema,
  productSummary: z.array(fixtureProductSummarySchema),
  advanceAmountPln: z.string().optional(),
  previousAdvanceInvoiceId: z.string().optional(),
  expectedExternalStepsSkipped: z.array(z.string()),
});

export const liveTestReportSchema = z.object({
  mode: liveTestModeSchema,
  meta: z.object({
    scenarioId: z.string(),
    invoiceType: invoiceTypeSchema,
    runnerVersion: z.string(),
    startedAt: z.string(),
    finishedAt: z.string(),
  }),
  safety: z.object({
    passed: z.boolean(),
    checks: z.array(safetyCheckSchema),
  }),
  productionReadiness: productionReadinessSchema,
  ksefStatus: ksefTestStatusSchema,
  bitrixSyncStatus: bitrixSyncTestStatusSchema,
  externalSideEffectsExecuted: z.literal(false),
  backendSmokeReadiness: z.object({
    mode: liveTestModeSchema,
    readinessKind: z.literal('BACKEND_SMOKE_READINESS'),
    scenarioType: invoiceTypeSchema,
    target: z.object({
      endpointName: z.literal('BITRIX_TRIGGER'),
      method: z.literal('POST'),
      path: z.literal('/invoice-processes/bitrix-trigger'),
      baseUrlConfigured: z.boolean(),
      baseUrlMasked: z.string().optional(),
      endpointCallAllowed: z.literal(false),
      endpointCalled: z.literal(false),
    }),
    auth: z.object({
      required: z.literal(true),
      headerNameConfigured: z.boolean(),
      secretConfigured: z.boolean(),
      secretDisplayed: z.literal(false),
    }),
    contract: z.object({
      compatibleWithBitrixTriggerRequestDto: z.boolean(),
      contractValidationStatus: z.enum(['PASSED', 'FAILED']),
    }),
    executionPolicy: z.object({
      backendEndpointAllowed: z.literal(false),
      useCaseExecutionAllowed: z.literal(false),
      dbWriteAllowed: z.literal(false),
      externalSideEffectsAllowed: z.literal(false),
    }),
    readinessStatus: z.enum([
      'READY_FOR_CONTROLLED_BACKEND_SMOKE',
      'NOT_READY_FOR_BACKEND_SMOKE',
    ]),
    blockers: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  backendContract: z.object({
    mode: liveTestModeSchema,
    scenarioType: invoiceTypeSchema,
    expectedInvoiceType: invoiceTypeSchema,
    trigger: z.object({
      bitrix_deal_id: z.string(),
      trigger_source: z.literal('BITRIX24_STAGE_CHANGE'),
      trigger_stage_id: z.string(),
      triggered_at: z.string(),
    }),
    executionPolicy: z.object({
      backendEndpointAllowed: z.literal(false),
      useCaseExecutionAllowed: z.literal(false),
      dbWriteAllowed: z.literal(false),
      externalSideEffectsAllowed: z.literal(false),
    }),
    contractValidationStatus: z.literal('PASSED'),
  }),
  backendDryRun: z.object({
    backendMode: liveTestModeSchema,
    backendWorkflowExecuted: z.literal(false),
    backendEndpointCalled: z.literal(false),
    useCaseExecuted: z.literal(false),
    invoiceProcessCreated: z.literal(false),
    invoiceRecordCreated: z.literal(false),
    invoiceEventCreated: z.literal(false),
    dbWriteExecuted: z.literal(false),
    validationSimulated: z.literal(true),
    mappedFromFixture: z.literal(true),
    resultStatus: z.literal('BACKEND_DRY_RUN_SIMULATED'),
    scenarioType: invoiceTypeSchema,
    expectedInvoiceType: invoiceTypeSchema,
    testContextId: z.string(),
    bitrixDealId: z.string(),
    notes: z.array(z.string()),
  }),
  fixture: fixtureReportSummarySchema,
  integrations: z.object({
    ksef: ksefTestStatusSchema,
    bitrixSync: bitrixSyncTestStatusSchema,
    bitrixDealSetup: integrationStepStatusSchema,
    backendWorkflow: integrationStepStatusSchema,
    fakturowniaOrder: integrationStepStatusSchema,
    fakturowniaInvoice: integrationStepStatusSchema,
    database: integrationStepStatusSchema,
  }),
  scenario: z.object({
    id: z.string(),
    invoiceType: invoiceTypeSchema,
    status: scenarioRunStatusSchema,
    steps: z.array(scenarioStepSchema),
    context: z
      .object({
        testContextId: z.string(),
        testDealTitle: z.string(),
        bitrixDealId: z.string(),
        idempotencyKey: z.string(),
      })
      .optional(),
    message: z.string().optional(),
  }),
  summary: z.string(),
});

export type LiveTestReport = z.infer<typeof liveTestReportSchema>;
