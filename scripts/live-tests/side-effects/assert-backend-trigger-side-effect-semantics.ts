import type { BackendTriggerSystemEffects } from './live-test-side-effects.types';
import type { RunnerDirectSideEffects } from './live-test-side-effects.types';

export class BackendTriggerSideEffectSemanticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendTriggerSideEffectSemanticsError';
  }
}

export function assertRunnerDirectSideEffectsRemainFalse(
  runnerDirect: RunnerDirectSideEffects,
): void {
  if (runnerDirect.runnerDirectBitrixCall) {
    throw new BackendTriggerSideEffectSemanticsError(
      'runnerDirectBitrixCall must be false',
    );
  }
  if (runnerDirect.runnerDirectFakturowniaCall) {
    throw new BackendTriggerSideEffectSemanticsError(
      'runnerDirectFakturowniaCall must be false',
    );
  }
  if (runnerDirect.runnerDirectDbWrite) {
    throw new BackendTriggerSideEffectSemanticsError(
      'runnerDirectDbWrite must be false',
    );
  }
  if (runnerDirect.runnerDirectKsefCall) {
    throw new BackendTriggerSideEffectSemanticsError(
      'runnerDirectKsefCall must be false',
    );
  }
  if (runnerDirect.runnerDirectExternalSideEffectsExecuted) {
    throw new BackendTriggerSideEffectSemanticsError(
      'runnerDirectExternalSideEffectsExecuted must be false',
    );
  }
}

export function assertBackendTriggerSystemEffectSemantics(
  effects: BackendTriggerSystemEffects,
): void {
  if (!effects.backendTriggerRequestSent) {
    if (effects.backendWorkflowExecutionAttempted) {
      throw new BackendTriggerSideEffectSemanticsError(
        'backendWorkflowExecutionAttempted must be false when backendTriggerRequestSent is false',
      );
    }
    if (effects.backendSideEffectsMayHaveOccurred) {
      throw new BackendTriggerSideEffectSemanticsError(
        'backendSideEffectsMayHaveOccurred must be false when backendTriggerRequestSent is false',
      );
    }
    return;
  }

  if (!effects.backendWorkflowExecutionAttempted) {
    throw new BackendTriggerSideEffectSemanticsError(
      'backendWorkflowExecutionAttempted must be true when backendTriggerRequestSent is true',
    );
  }

  if (!effects.backendSideEffectsMayHaveOccurred) {
    throw new BackendTriggerSideEffectSemanticsError(
      'backendSideEffectsMayHaveOccurred must be true when backendTriggerRequestSent is true',
    );
  }
}

export function assertReportSideEffectSemantics(input: {
  runnerDirect: RunnerDirectSideEffects;
  runnerDirectExternalSideEffectsExecuted: false;
  manualVerificationRequired: boolean;
  systemEffects: BackendTriggerSystemEffects;
}): void {
  assertRunnerDirectSideEffectsRemainFalse(input.runnerDirect);

  if (input.runnerDirectExternalSideEffectsExecuted !== false) {
    throw new BackendTriggerSideEffectSemanticsError(
      'Top-level runnerDirectExternalSideEffectsExecuted must be false',
    );
  }

  assertBackendTriggerSystemEffectSemantics(input.systemEffects);

  if (
    input.systemEffects.backendTriggerRequestSent &&
    !input.manualVerificationRequired
  ) {
    throw new BackendTriggerSideEffectSemanticsError(
      'manualVerificationRequired must be true when backendTriggerRequestSent is true',
    );
  }

  if (
    !input.systemEffects.backendTriggerRequestSent &&
    input.manualVerificationRequired
  ) {
    throw new BackendTriggerSideEffectSemanticsError(
      'manualVerificationRequired must be false when backendTriggerRequestSent is false',
    );
  }
}
