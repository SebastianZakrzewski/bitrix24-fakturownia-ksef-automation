import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
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

  if (!report.manualVerificationRequired) {
    throw new LiveTriggerSmokeReportAssertionError(
      'manualVerificationRequired must be true for trigger smoke',
    );
  }

  if (report.productionReadiness !== 'NOT_READY') {
    throw new LiveTriggerSmokeReportAssertionError(
      'productionReadiness must remain NOT_READY',
    );
  }

  if (report.externalSideEffectsExecuted !== false) {
    throw new LiveTriggerSmokeReportAssertionError(
      'Runner must not mark externalSideEffectsExecuted=true',
    );
  }

  if (report.backendTriggerExecution.target.secretDisplayed !== false) {
    throw new LiveTriggerSmokeReportAssertionError('Auth secret must not be displayed');
  }

  const execution = report.backendTriggerExecution.execution;
  if (execution.bitrixCalled || execution.fakturowniaCalled || execution.ksefTested) {
    throw new LiveTriggerSmokeReportAssertionError(
      'Runner must not call Bitrix, Fakturownia, or KSeF directly',
    );
  }

  if (execution.dbWriteExecuted) {
    throw new LiveTriggerSmokeReportAssertionError(
      'Runner must not claim direct DB writes',
    );
  }

  const secret = process.env.LIVE_TEST_BACKEND_AUTH_SECRET?.trim();
  if (secret) {
    const json = JSON.stringify(report);
    const markdown = JSON.stringify(report.backendTriggerExecution);
    if (json.includes(secret) || markdown.includes(secret)) {
      throw new LiveTriggerSmokeReportAssertionError(
        'Report must not contain LIVE_TEST_BACKEND_AUTH_SECRET value',
      );
    }
  }

  if (
    report.backendTriggerExecution.resultStatus === 'BACKEND_TRIGGER_EXECUTION_SENT'
  ) {
    const payload = report.backendTriggerExecution.request.payload;
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
    if (!report.backendTriggerExecution.execution.requestSent) {
      throw new LiveTriggerSmokeReportAssertionError(
        'requestSent must be true when execution was sent',
      );
    }
  }
}
