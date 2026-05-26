import { z } from 'zod';

export const LIVE_TEST_RUNNER_VERSION = '1.2.0-fixtures';

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
