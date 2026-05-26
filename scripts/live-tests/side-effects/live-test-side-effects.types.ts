import { z } from 'zod';

export const runnerDirectSideEffectsSchema = z.object({
  runnerDirectBitrixCall: z.literal(false),
  runnerDirectFakturowniaCall: z.literal(false),
  runnerDirectDbWrite: z.literal(false),
  runnerDirectKsefCall: z.literal(false),
  runnerDirectExternalSideEffectsExecuted: z.literal(false),
});

export type RunnerDirectSideEffects = z.infer<typeof runnerDirectSideEffectsSchema>;

export const backendEffectTriStateSchema = z.enum(['false', 'true', 'unknown']);

export type BackendEffectTriState = z.infer<typeof backendEffectTriStateSchema>;

export const backendTriggerSystemEffectsSchema = z.object({
  backendTriggerRequestSent: z.boolean(),
  backendEndpointCalled: z.boolean(),
  backendWorkflowExecutionAttempted: z.boolean(),
  backendWorkflowMayHaveExecuted: z.boolean(),
  backendSideEffectsMayHaveOccurred: z.boolean(),
  dbWriteMayHaveOccurred: z.boolean(),
  bitrixMayHaveBeenCalled: z.boolean(),
  fakturowniaMayHaveBeenCalled: z.boolean(),
  invoiceMayHaveBeenCreated: backendEffectTriStateSchema,
  ksefMayHaveBeenHandledByFakturownia: backendEffectTriStateSchema,
});

export type BackendTriggerSystemEffects = z.infer<
  typeof backendTriggerSystemEffectsSchema
>;

export const RUNNER_DIRECT_SIDE_EFFECTS: RunnerDirectSideEffects = {
  runnerDirectBitrixCall: false,
  runnerDirectFakturowniaCall: false,
  runnerDirectDbWrite: false,
  runnerDirectKsefCall: false,
  runnerDirectExternalSideEffectsExecuted: false,
};

export const BLOCKED_BACKEND_TRIGGER_SYSTEM_EFFECTS: BackendTriggerSystemEffects = {
  backendTriggerRequestSent: false,
  backendEndpointCalled: false,
  backendWorkflowExecutionAttempted: false,
  backendWorkflowMayHaveExecuted: false,
  backendSideEffectsMayHaveOccurred: false,
  dbWriteMayHaveOccurred: false,
  bitrixMayHaveBeenCalled: false,
  fakturowniaMayHaveBeenCalled: false,
  invoiceMayHaveBeenCreated: 'false',
  ksefMayHaveBeenHandledByFakturownia: 'false',
};
