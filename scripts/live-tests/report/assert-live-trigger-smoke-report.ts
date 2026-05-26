import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import { resolveBackendAuthSecret } from '../resolve-backend-auth-secret';
import { assertReportSideEffectSemantics } from '../side-effects/assert-backend-trigger-side-effect-semantics';
import {
  liveTestReportSchema,
  type LiveTestReport,
} from '../types/live-test-report.types';

export class LiveTriggerSmokeReportAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveTriggerSmokeReportAssertionError';
  }
}

function assertNoLegacyUnscopedExternalSideEffectsField(report: LiveTestReport): void {
  const raw = report as LiveTestReport & { externalSideEffectsExecuted?: boolean };
  if ('externalSideEffectsExecuted' in raw) {
    throw new LiveTriggerSmokeReportAssertionError(
      'Report must not use unscoped externalSideEffectsExecuted; use runnerDirectExternalSideEffectsExecuted',
    );
  }
}

export function assertLiveTriggerSmokeReport(report: LiveTestReport): void {
  const parsed = liveTestReportSchema.safeParse(report);
  if (!parsed.success) {
    throw new LiveTriggerSmokeReportAssertionError(
      `Report schema invalid: ${parsed.error.message}`,
    );
  }

  if (report.mode !== 'CONTROLLED_LIVE_TRIGGER_SMOKE') {
    throw new LiveTriggerSmokeReportAssertionError(
      `Expected mode CONTROLLED_LIVE_TRIGGER_SMOKE, got ${report.mode}`,
    );
  }

  if (report.productionReadiness !== 'NOT_READY') {
    throw new LiveTriggerSmokeReportAssertionError(
      'productionReadiness must remain NOT_READY',
    );
  }

  assertNoLegacyUnscopedExternalSideEffectsField(report);

  if (report.runnerDirectExternalSideEffectsExecuted !== false) {
    throw new LiveTriggerSmokeReportAssertionError(
      'runnerDirectExternalSideEffectsExecuted must be false',
    );
  }

  try {
    assertReportSideEffectSemantics({
      runnerDirect: report.runnerDirectSideEffects,
      runnerDirectExternalSideEffectsExecuted: false,
      manualVerificationRequired: report.manualVerificationRequired,
      systemEffects: report.backendTriggerExecution.systemEffects,
    });
  } catch (error: unknown) {
    throw new LiveTriggerSmokeReportAssertionError(
      error instanceof Error ? error.message : String(error),
    );
  }

  if (report.backendTriggerExecution.target.secretDisplayed !== false) {
    throw new LiveTriggerSmokeReportAssertionError('Auth secret must not be displayed');
  }

  const secret = resolveBackendAuthSecret(process.env);
  if (secret) {
    const json = JSON.stringify(report);
    if (json.includes(secret)) {
      throw new LiveTriggerSmokeReportAssertionError(
        'Report must not contain backend auth secret value',
      );
    }
  }

  if (
    report.backendTriggerExecution.resultStatus === 'BACKEND_TRIGGER_EXECUTION_SENT'
  ) {
    const payload = report.backendTriggerExecution.request.payload;
    const effects = report.backendTriggerExecution.systemEffects;
    if (payload.bitrix_deal_id !== LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID) {
      throw new LiveTriggerSmokeReportAssertionError(
        `Trigger payload bitrix_deal_id must be ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
      );
    }
    if (payload.trigger_source !== 'BITRIX24_STAGE_CHANGE') {
      throw new LiveTriggerSmokeReportAssertionError(
        'trigger_source must be BITRIX24_STAGE_CHANGE',
      );
    }
    if (payload.trigger_stage_id !== 'PREPARATION') {
      throw new LiveTriggerSmokeReportAssertionError(
        'trigger_stage_id must be PREPARATION',
      );
    }
    if (!effects.backendTriggerRequestSent) {
      throw new LiveTriggerSmokeReportAssertionError(
        'backendTriggerRequestSent must be true when execution was sent',
      );
    }
    if (!effects.backendWorkflowExecutionAttempted) {
      throw new LiveTriggerSmokeReportAssertionError(
        'backendWorkflowExecutionAttempted must be true when execution was sent',
      );
    }
    if (!effects.backendSideEffectsMayHaveOccurred) {
      throw new LiveTriggerSmokeReportAssertionError(
        'backendSideEffectsMayHaveOccurred must be true when execution was sent',
      );
    }
    if (!report.manualVerificationRequired) {
      throw new LiveTriggerSmokeReportAssertionError(
        'manualVerificationRequired must be true when execution was sent',
      );
    }
  }
}
