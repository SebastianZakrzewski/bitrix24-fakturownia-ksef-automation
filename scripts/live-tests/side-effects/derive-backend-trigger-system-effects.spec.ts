import {
  deriveBackendTriggerSystemEffects,
  manualVerificationRequiredFromSystemEffects,
} from './derive-backend-trigger-system-effects';

describe('deriveBackendTriggerSystemEffects', () => {
  it('returns all-false semantics when request was not sent', () => {
    const effects = deriveBackendTriggerSystemEffects({
      requestSent: false,
      endpointCalled: false,
      workflowAccepted: false,
    });

    expect(effects.backendTriggerRequestSent).toBe(false);
    expect(effects.backendWorkflowExecutionAttempted).toBe(false);
    expect(effects.backendSideEffectsMayHaveOccurred).toBe(false);
    expect(manualVerificationRequiredFromSystemEffects(effects)).toBe(false);
  });

  it('marks backend side effects as possible after successful POST', () => {
    const effects = deriveBackendTriggerSystemEffects({
      requestSent: true,
      endpointCalled: true,
      workflowAccepted: true,
    });

    expect(effects.backendTriggerRequestSent).toBe(true);
    expect(effects.backendEndpointCalled).toBe(true);
    expect(effects.backendWorkflowExecutionAttempted).toBe(true);
    expect(effects.backendWorkflowMayHaveExecuted).toBe(true);
    expect(effects.backendSideEffectsMayHaveOccurred).toBe(true);
    expect(effects.invoiceMayHaveBeenCreated).toBe('unknown');
    expect(manualVerificationRequiredFromSystemEffects(effects)).toBe(true);
  });

  it('requires manual verification when POST was sent but response uncertain', () => {
    const effects = deriveBackendTriggerSystemEffects({
      requestSent: true,
      endpointCalled: false,
      workflowAccepted: false,
    });

    expect(effects.backendTriggerRequestSent).toBe(true);
    expect(effects.backendSideEffectsMayHaveOccurred).toBe(true);
    expect(effects.backendWorkflowMayHaveExecuted).toBe(false);
    expect(manualVerificationRequiredFromSystemEffects(effects)).toBe(true);
  });
});
