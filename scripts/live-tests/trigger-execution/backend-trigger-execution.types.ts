import { z } from 'zod';
import { bitrixTriggerSourceSchema } from '../contracts/backend-dry-run-contract.types';
import { invoiceTypeSchema } from '../types/live-test-report.types';

export const BACKEND_TRIGGER_EXECUTION_METHOD = 'POST' as const;
export const BACKEND_TRIGGER_EXECUTION_PATH =
  '/invoice-processes/bitrix-trigger' as const;

export const backendTriggerExecutionModeSchema = z.literal(
  'CONTROLLED_LIVE_TRIGGER_EXECUTION',
);
export type BackendTriggerExecutionMode = z.infer<
  typeof backendTriggerExecutionModeSchema
>;

export const backendTriggerExecutionKindSchema = z.literal(
  'BACKEND_TRIGGER_EXECUTION',
);
export type BackendTriggerExecutionKind = z.infer<
  typeof backendTriggerExecutionKindSchema
>;

export const backendTriggerExecutionResultStatusSchema = z.enum([
  'BACKEND_TRIGGER_EXECUTION_BLOCKED',
  'BACKEND_TRIGGER_EXECUTION_SENT',
  'BACKEND_TRIGGER_EXECUTION_FAILED',
  'BACKEND_TRIGGER_EXECUTION_TIMEOUT',
]);
export type BackendTriggerExecutionResultStatus = z.infer<
  typeof backendTriggerExecutionResultStatusSchema
>;

export const bitrixTriggerExecutionPayloadSchema = z.object({
  bitrix_deal_id: z.string(),
  trigger_source: bitrixTriggerSourceSchema,
  trigger_stage_id: z.string(),
  triggered_at: z.string(),
});

export type BitrixTriggerExecutionPayload = z.infer<
  typeof bitrixTriggerExecutionPayloadSchema
>;

export const backendTriggerExecutionResultSchema = z.object({
  mode: backendTriggerExecutionModeSchema,
  executionKind: backendTriggerExecutionKindSchema,
  scenarioType: invoiceTypeSchema,
  gate: z.object({
    executionAllowed: z.boolean(),
    triggerExecutionAllowed: z.boolean(),
    blockers: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  target: z.object({
    method: z.literal(BACKEND_TRIGGER_EXECUTION_METHOD),
    path: z.literal(BACKEND_TRIGGER_EXECUTION_PATH),
    baseUrlConfigured: z.boolean(),
    authHeaderNameConfigured: z.boolean(),
    authSecretConfigured: z.boolean(),
    secretDisplayed: z.literal(false),
  }),
  request: z.object({
    payload: bitrixTriggerExecutionPayloadSchema,
    timeoutMs: z.number().int().positive(),
  }),
  response: z
    .object({
      statusCode: z.number().int(),
      ok: z.boolean(),
      processId: z.string().optional(),
      triggerStatus: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
  execution: z.object({
    requestSent: z.boolean(),
    endpointCalled: z.boolean(),
    workflowExecuted: z.boolean(),
    invoiceProcessCreated: z.literal(false),
    invoiceRecordCreated: z.literal(false),
    dbWriteExecuted: z.literal(false),
    bitrixCalled: z.literal(false),
    fakturowniaCalled: z.literal(false),
    ksefTested: z.literal(false),
  }),
  resultStatus: backendTriggerExecutionResultStatusSchema,
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export type BackendTriggerExecutionResult = z.infer<
  typeof backendTriggerExecutionResultSchema
>;
