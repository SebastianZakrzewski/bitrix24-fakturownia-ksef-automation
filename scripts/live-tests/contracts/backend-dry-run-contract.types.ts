import { z } from 'zod';
import { invoiceTypeSchema, liveTestModeSchema } from '../types/live-test-report.types';

/** Documented n8n trigger DTO shape from `/docs/contracts.md` (dry-run representation only). */
export const bitrixTriggerSourceSchema = z.literal('BITRIX24_STAGE_CHANGE');
export type BitrixTriggerSource = z.infer<typeof bitrixTriggerSourceSchema>;

export const backendDryRunTriggerContractSchema = z.object({
  bitrix_deal_id: z.string(),
  trigger_source: bitrixTriggerSourceSchema,
  trigger_stage_id: z.string().min(1),
  triggered_at: z.string(),
});

export type BackendDryRunTriggerContract = z.infer<
  typeof backendDryRunTriggerContractSchema
>;

export const backendDryRunFixtureContextSchema = z.object({
  fixtureId: z.string(),
  bitrixDealId: z.string(),
  hasSyntheticBuyer: z.boolean(),
  hasProducts: z.boolean(),
  hasAdvanceAmount: z.boolean().optional(),
  hasPreviousAdvanceInvoiceId: z.boolean().optional(),
});

export type BackendDryRunFixtureContext = z.infer<
  typeof backendDryRunFixtureContextSchema
>;

export const backendDryRunExecutionPolicySchema = z.object({
  backendEndpointAllowed: z.literal(false),
  useCaseExecutionAllowed: z.literal(false),
  dbWriteAllowed: z.literal(false),
  externalSideEffectsAllowed: z.literal(false),
});

export type BackendDryRunExecutionPolicy = z.infer<
  typeof backendDryRunExecutionPolicySchema
>;

export const backendDryRunContractSchema = z.object({
  mode: liveTestModeSchema,
  scenarioType: invoiceTypeSchema,
  expectedInvoiceType: invoiceTypeSchema,
  trigger: backendDryRunTriggerContractSchema,
  fixtureContext: backendDryRunFixtureContextSchema,
  executionPolicy: backendDryRunExecutionPolicySchema,
});

export type BackendDryRunContract = z.infer<typeof backendDryRunContractSchema>;

export const backendDryRunContractValidationStatusSchema = z.enum([
  'PASSED',
  'FAILED',
]);
export type BackendDryRunContractValidationStatus = z.infer<
  typeof backendDryRunContractValidationStatusSchema
>;

/** Report-safe contract summary (no full fixture payload). */
export const backendDryRunContractReportSchema = z.object({
  mode: liveTestModeSchema,
  scenarioType: invoiceTypeSchema,
  expectedInvoiceType: invoiceTypeSchema,
  trigger: backendDryRunTriggerContractSchema,
  executionPolicy: backendDryRunExecutionPolicySchema,
  contractValidationStatus: z.literal('PASSED'),
});

export type BackendDryRunContractReport = z.infer<
  typeof backendDryRunContractReportSchema
>;
