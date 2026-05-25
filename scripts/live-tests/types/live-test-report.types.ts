import { z } from 'zod';

export const LIVE_TEST_RUNNER_VERSION = '1.0.0-skeleton';

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
  'PASSED',
  'FAILED',
]);
export type IntegrationStepStatus = z.infer<typeof integrationStepStatusSchema>;

export const invoiceTypeSchema = z.enum(['FULL', 'ADVANCE', 'FINAL']);
export type LiveTestInvoiceType = z.infer<typeof invoiceTypeSchema>;

export const scenarioRunStatusSchema = z.enum([
  'PLACEHOLDER_SKIPPED',
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

export const liveTestReportSchema = z.object({
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
    steps: z.array(
      z.object({
        name: z.string(),
        status: integrationStepStatusSchema,
        message: z.string().optional(),
      }),
    ),
    message: z.string().optional(),
  }),
  summary: z.string(),
});

export type LiveTestReport = z.infer<typeof liveTestReportSchema>;
