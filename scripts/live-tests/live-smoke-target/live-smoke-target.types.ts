import { z } from 'zod';
import { invoiceTypeSchema } from '../types/live-test-report.types';

export const liveSmokeTargetSchema = z.object({
  actualBitrixDealId: z.string().min(1),
  testDealLabel: z.string().min(1),
  expectedScenarioType: invoiceTypeSchema,
  expectedTriggerStageId: z.string().min(1),
  manualCrmPreparationConfirmed: z.boolean(),
});

export type LiveSmokeTarget = z.infer<typeof liveSmokeTargetSchema>;

export const liveSmokeTargetValidationSchema = z.object({
  valid: z.boolean(),
  testDealLabelStartsWithTestPrefix: z.boolean(),
  liveExecutionReady: z.boolean(),
  errors: z.array(z.string()),
});

export type LiveSmokeTargetValidation = z.infer<
  typeof liveSmokeTargetValidationSchema
>;

export const MANUAL_CRM_PREPARATION_REQUIREMENTS = [
  'Create or select a Bitrix24 deal manually as a dedicated test object.',
  'Ensure the CRM deal title/label starts with [TEST] (human confirmation, not the numeric deal ID).',
  'Set LIVE_TEST_ACTUAL_BITRIX_DEAL_ID to the real numeric Bitrix deal ID used by the backend trigger.',
  'Set LIVE_TEST_DEAL_LABEL to the exact CRM deal title for operator verification.',
  'Set LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED=true only after verifying the CRM deal is safe to use.',
] as const;
