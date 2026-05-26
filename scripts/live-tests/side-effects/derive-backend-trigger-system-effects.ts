import type { BackendTriggerSystemEffects } from './live-test-side-effects.types';
import { BLOCKED_BACKEND_TRIGGER_SYSTEM_EFFECTS } from './live-test-side-effects.types';

export interface DeriveBackendTriggerSystemEffectsInput {
  /** Runner sent HTTP POST to backend trigger endpoint. */
  requestSent: boolean;
  /** Runner received an HTTP response from backend trigger endpoint. */
  endpointCalled: boolean;
  /** Backend accepted trigger (HTTP 202). */
  workflowAccepted: boolean;
}

/**
 * Maps low-level trigger HTTP outcome to honest system-level side-effect semantics.
 */
export function deriveBackendTriggerSystemEffects(
  input: DeriveBackendTriggerSystemEffectsInput,
): BackendTriggerSystemEffects {
  if (!input.requestSent) {
    return { ...BLOCKED_BACKEND_TRIGGER_SYSTEM_EFFECTS };
  }

  const endpointReached = input.endpointCalled;

  return {
    backendTriggerRequestSent: true,
    backendEndpointCalled: endpointReached,
    backendWorkflowExecutionAttempted: true,
    backendWorkflowMayHaveExecuted: endpointReached && input.workflowAccepted,
    backendSideEffectsMayHaveOccurred: true,
    dbWriteMayHaveOccurred: endpointReached,
    bitrixMayHaveBeenCalled: endpointReached,
    fakturowniaMayHaveBeenCalled: endpointReached,
    invoiceMayHaveBeenCreated:
      endpointReached && input.workflowAccepted ? 'unknown' : 'false',
    ksefMayHaveBeenHandledByFakturownia:
      endpointReached && input.workflowAccepted ? 'unknown' : 'false',
  };
}

export function manualVerificationRequiredFromSystemEffects(
  effects: BackendTriggerSystemEffects,
): boolean {
  return effects.backendTriggerRequestSent;
}
