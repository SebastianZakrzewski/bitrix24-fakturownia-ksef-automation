import { z } from 'zod';
import {
  backendDryRunTriggerContractSchema,
  bitrixTriggerSourceSchema,
} from '../contracts/backend-dry-run-contract.types';
import { invoiceTypeSchema } from '../types/live-test-report.types';

export const BACKEND_TRIGGER_PREFLIGHT_METHOD = 'POST' as const;
export const BACKEND_TRIGGER_PREFLIGHT_PATH =
  '/invoice-processes/bitrix-trigger' as const;

export const backendTriggerPreflightModeSchema = z.literal(
  'CONTROLLED_BACKEND_PREFLIGHT',
);
export type BackendTriggerPreflightMode = z.infer<
  typeof backendTriggerPreflightModeSchema
>;

export const backendTriggerPreflightKindSchema = z.literal(
  'BACKEND_TRIGGER_PREFLIGHT',
);
export type BackendTriggerPreflightKind = z.infer<
  typeof backendTriggerPreflightKindSchema
>;

export const backendTriggerPreflightStatusSchema = z.enum([
  'BACKEND_TRIGGER_PREFLIGHT_PASSED',
  'BACKEND_TRIGGER_PREFLIGHT_FAILED',
  'BACKEND_TRIGGER_PREFLIGHT_NOT_READY',
]);
export type BackendTriggerPreflightStatus = z.infer<
  typeof backendTriggerPreflightStatusSchema
>;

export const bitrixTriggerRequestPayloadSchema = backendDryRunTriggerContractSchema;
export type BitrixTriggerRequestPayload = z.infer<
  typeof bitrixTriggerRequestPayloadSchema
>;

export const backendTriggerPreflightResultSchema = z.object({
  mode: backendTriggerPreflightModeSchema,
  preflightKind: backendTriggerPreflightKindSchema,
  scenarioType: invoiceTypeSchema,
  target: z.object({
    method: z.literal(BACKEND_TRIGGER_PREFLIGHT_METHOD),
    path: z.literal(BACKEND_TRIGGER_PREFLIGHT_PATH),
    baseUrlConfigured: z.boolean(),
    authHeaderNameConfigured: z.boolean(),
    authSecretConfigured: z.boolean(),
    secretDisplayed: z.literal(false),
  }),
  request: z.object({
    payloadShapeValid: z.boolean(),
    payload: z.object({
      bitrix_deal_id: z.string(),
      trigger_source: bitrixTriggerSourceSchema,
      trigger_stage_id: z.string(),
      triggered_at: z.string(),
    }),
  }),
  executionPolicy: z.object({
    triggerExecutionAllowed: z.literal(false),
    backendEndpointAllowed: z.literal(false),
    useCaseExecutionAllowed: z.literal(false),
    dbWriteAllowed: z.literal(false),
    externalSideEffectsAllowed: z.literal(false),
  }),
  execution: z.object({
    requestSent: z.literal(false),
    endpointCalled: z.literal(false),
    workflowExecuted: z.literal(false),
    invoiceProcessCreated: z.literal(false),
    invoiceRecordCreated: z.literal(false),
    dbWriteExecuted: z.literal(false),
    bitrixCalled: z.literal(false),
    fakturowniaCalled: z.literal(false),
    ksefTested: z.literal(false),
  }),
  preflightStatus: backendTriggerPreflightStatusSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type BackendTriggerPreflightResult = z.infer<
  typeof backendTriggerPreflightResultSchema
>;
