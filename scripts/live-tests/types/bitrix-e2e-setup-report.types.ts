import { z } from 'zod';
import {
  BITRIX_E2E_SETUP_MODE,
  BITRIX_E2E_TRIGGER_MODE,
} from '../bitrix-e2e-setup/bitrix-e2e-setup.types';
import { productionReadinessSchema } from './live-test-report.types';

export const LIVE_TEST_RUNNER_VERSION_BITRIX_E2E = '1.11.0-bitrix-e2e-setup';

export const bitrixE2eRunnerDirectSideEffectsSchema = z.object({
  runnerDirectBitrixCall: z.boolean(),
  runnerDirectFakturowniaCall: z.literal(false),
  runnerDirectDbWrite: z.literal(false),
  runnerDirectKsefCall: z.literal(false),
  runnerDirectBackendTrigger: z.literal(false),
  runnerDirectExternalSideEffectsExecuted: z.boolean(),
});

export const bitrixE2eSetupSectionSchema = z.object({
  mode: z.literal(BITRIX_E2E_SETUP_MODE),
  triggerMode: z.literal(BITRIX_E2E_TRIGGER_MODE),
  scenarioType: z.literal('FULL'),
  expectedInvoiceType: z.literal('FULL'),
  gate: z.object({
    setupAllowed: z.boolean(),
    dealCreationAllowed: z.boolean(),
    stageChangeAllowed: z.boolean(),
    blockers: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  bitrixDealCreated: z.boolean(),
  bitrixDealUpdated: z.boolean(),
  bitrixStageChanged: z.boolean(),
  bitrixDealId: z.string().optional(),
  dealTitle: z.string(),
  dealTitleStartsWithTestPrefix: z.boolean(),
  paidStageId: z.string(),
  runnerDirectBackendTrigger: z.literal(false),
  backendTriggerRequestSent: z.literal(false),
  bitrixAutomationExpected: z.literal(true),
  n8nTriggerExpected: z.literal(true),
  backendWorkflowMayHaveExecuted: z.boolean(),
  backendSideEffectsMayHaveOccurred: z.boolean(),
  webhookConfigured: z.boolean(),
  webhookMasked: z.string().optional(),
  secretDisplayed: z.literal(false),
  resultStatus: z.enum([
    'BITRIX_E2E_SETUP_BLOCKED',
    'BITRIX_E2E_SETUP_COMPLETED',
    'BITRIX_E2E_SETUP_FAILED',
  ]),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export const bitrixE2eSetupReportSchema = z.object({
  mode: z.literal(BITRIX_E2E_SETUP_MODE),
  triggerMode: z.literal(BITRIX_E2E_TRIGGER_MODE),
  meta: z.object({
    scenarioId: z.literal('full'),
    invoiceType: z.literal('FULL'),
    runnerVersion: z.string(),
    startedAt: z.string(),
    finishedAt: z.string(),
  }),
  safety: z.object({
    passed: z.boolean(),
    checks: z.array(
      z.object({
        code: z.string(),
        status: z.enum(['passed', 'failed', 'skipped']),
        message: z.string(),
      }),
    ),
  }),
  productionReadiness: productionReadinessSchema,
  scenarioType: z.literal('FULL'),
  expectedInvoiceType: z.literal('FULL'),
  bitrixDealCreated: z.boolean(),
  bitrixDealUpdated: z.boolean(),
  bitrixStageChanged: z.boolean(),
  bitrixDealId: z.string().optional(),
  dealTitle: z.string(),
  dealTitleStartsWithTestPrefix: z.boolean(),
  paidStageId: z.string(),
  runnerDirectBackendTrigger: z.literal(false),
  backendTriggerRequestSent: z.literal(false),
  bitrixAutomationExpected: z.literal(true),
  n8nTriggerExpected: z.literal(true),
  backendWorkflowMayHaveExecuted: z.boolean(),
  backendSideEffectsMayHaveOccurred: z.boolean(),
  manualVerificationRequired: z.literal(true),
  deleteOrCancelExecuted: z.literal(false),
  bulkExecution: z.literal(false),
  runnerDirectSideEffects: bitrixE2eRunnerDirectSideEffectsSchema,
  runnerDirectExternalSideEffectsExecuted: z.boolean(),
  bitrixE2eSetup: bitrixE2eSetupSectionSchema,
  summary: z.string(),
});

export type BitrixE2eSetupReport = z.infer<typeof bitrixE2eSetupReportSchema>;
