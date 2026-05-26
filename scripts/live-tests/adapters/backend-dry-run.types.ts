import { z } from 'zod';
import { invoiceTypeSchema, liveTestModeSchema } from '../types/live-test-report.types';

export const backendDryRunResultStatusSchema = z.literal('BACKEND_DRY_RUN_SIMULATED');
export type BackendDryRunResultStatus = z.infer<typeof backendDryRunResultStatusSchema>;

export const backendDryRunResultSchema = z.object({
  scenarioType: invoiceTypeSchema,
  expectedInvoiceType: invoiceTypeSchema,
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
  resultStatus: backendDryRunResultStatusSchema,
  testContextId: z.string(),
  bitrixDealId: z.string(),
  idempotencyKey: z.string(),
  notes: z.array(z.string()),
});

export type BackendDryRunResult = z.infer<typeof backendDryRunResultSchema>;
