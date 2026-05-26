import { z } from 'zod';
import { invoiceTypeSchema, liveTestModeSchema } from '../types/live-test-report.types';

export const BACKEND_SMOKE_TRIGGER_ENDPOINT_NAME = 'BITRIX_TRIGGER' as const;
export const BACKEND_SMOKE_TRIGGER_METHOD = 'POST' as const;
export const BACKEND_SMOKE_TRIGGER_PATH = '/invoice-processes/bitrix-trigger' as const;

export const backendSmokeReadinessKindSchema = z.literal('BACKEND_SMOKE_READINESS');
export type BackendSmokeReadinessKind = z.infer<
  typeof backendSmokeReadinessKindSchema
>;

export const backendSmokeReadinessStatusSchema = z.enum([
  'READY_FOR_CONTROLLED_BACKEND_SMOKE',
  'NOT_READY_FOR_BACKEND_SMOKE',
]);
export type BackendSmokeReadinessStatus = z.infer<
  typeof backendSmokeReadinessStatusSchema
>;

export const backendSmokeContractValidationStatusSchema = z.enum([
  'PASSED',
  'FAILED',
]);
export type BackendSmokeContractValidationStatus = z.infer<
  typeof backendSmokeContractValidationStatusSchema
>;

export const backendSmokeReadinessResultSchema = z.object({
  mode: liveTestModeSchema,
  readinessKind: backendSmokeReadinessKindSchema,
  scenarioType: invoiceTypeSchema,
  target: z.object({
    endpointName: z.literal(BACKEND_SMOKE_TRIGGER_ENDPOINT_NAME),
    method: z.literal(BACKEND_SMOKE_TRIGGER_METHOD),
    path: z.literal(BACKEND_SMOKE_TRIGGER_PATH),
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
    contractValidationStatus: backendSmokeContractValidationStatusSchema,
  }),
  executionPolicy: z.object({
    backendEndpointAllowed: z.literal(false),
    useCaseExecutionAllowed: z.literal(false),
    dbWriteAllowed: z.literal(false),
    externalSideEffectsAllowed: z.literal(false),
  }),
  readinessStatus: backendSmokeReadinessStatusSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type BackendSmokeReadinessResult = z.infer<
  typeof backendSmokeReadinessResultSchema
>;

export const backendSmokeReadinessReportSchema = backendSmokeReadinessResultSchema;
export type BackendSmokeReadinessReport = z.infer<
  typeof backendSmokeReadinessReportSchema
>;
