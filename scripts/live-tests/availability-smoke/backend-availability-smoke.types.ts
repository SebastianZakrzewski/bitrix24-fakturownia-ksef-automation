import { z } from 'zod';

export const BACKEND_HEALTH_SMOKE_METHOD = 'GET' as const;
export const DEFAULT_BACKEND_HEALTH_PATH = '/health' as const;
export const DEFAULT_BACKEND_HEALTH_TIMEOUT_MS = 5000;

export const backendAvailabilitySmokeModeSchema = z.literal(
  'CONTROLLED_BACKEND_SMOKE',
);
export type BackendAvailabilitySmokeMode = z.infer<
  typeof backendAvailabilitySmokeModeSchema
>;

export const backendAvailabilitySmokeKindSchema = z.literal('BACKEND_AVAILABILITY');
export type BackendAvailabilitySmokeKind = z.infer<
  typeof backendAvailabilitySmokeKindSchema
>;

export const backendAvailabilityResultStatusSchema = z.enum([
  'BACKEND_HEALTH_PASSED',
  'BACKEND_HEALTH_FAILED',
  'BACKEND_HEALTH_NOT_CONFIGURED',
  'BACKEND_HEALTH_TIMEOUT',
]);
export type BackendAvailabilityResultStatus = z.infer<
  typeof backendAvailabilityResultStatusSchema
>;

export const backendAvailabilitySmokeResultSchema = z.object({
  mode: backendAvailabilitySmokeModeSchema,
  smokeKind: backendAvailabilitySmokeKindSchema,
  target: z.object({
    method: z.literal(BACKEND_HEALTH_SMOKE_METHOD),
    path: z.string(),
    baseUrlConfigured: z.boolean(),
    endpointCalled: z.boolean(),
  }),
  request: z.object({
    timeoutMs: z.number().int().positive(),
  }),
  response: z
    .object({
      statusCode: z.number().int(),
      ok: z.boolean(),
    })
    .optional(),
  resultStatus: backendAvailabilityResultStatusSchema,
  externalSideEffectsExecuted: z.literal(false),
  workflowExecuted: z.literal(false),
  invoiceProcessCreated: z.literal(false),
  invoiceRecordCreated: z.literal(false),
  dbWriteExecuted: z.literal(false),
  bitrixCalled: z.literal(false),
  fakturowniaCalled: z.literal(false),
  ksefTested: z.literal(false),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

export type BackendAvailabilitySmokeResult = z.infer<
  typeof backendAvailabilitySmokeResultSchema
>;
