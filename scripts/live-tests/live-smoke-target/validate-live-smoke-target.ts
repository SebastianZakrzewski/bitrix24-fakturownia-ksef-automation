import { hasTestDealPrefix } from '../fixtures/fixture-common';
import type { LiveTestInvoiceType } from '../types/live-test-report.types';
import {
  liveSmokeTargetValidationSchema,
  type LiveSmokeTarget,
  type LiveSmokeTargetValidation,
} from './live-smoke-target.types';

export interface ValidateLiveSmokeTargetInput {
  target: LiveSmokeTarget;
  scenarioType: LiveTestInvoiceType;
}

export function validateLiveSmokeTarget(
  input: ValidateLiveSmokeTargetInput,
): LiveSmokeTargetValidation {
  const { target, scenarioType } = input;
  const errors: string[] = [];

  if (!target.actualBitrixDealId.trim()) {
    errors.push('actualBitrixDealId is required');
  }

  if (!target.testDealLabel.trim()) {
    errors.push('testDealLabel is required');
  }

  const testDealLabelStartsWithTestPrefix = hasTestDealPrefix(target.testDealLabel);
  if (!testDealLabelStartsWithTestPrefix) {
    errors.push('testDealLabel must start with [TEST]');
  }

  if (target.expectedScenarioType !== scenarioType) {
    errors.push('expectedScenarioType must match selected scenario');
  }

  if (!target.expectedTriggerStageId.trim()) {
    errors.push('expectedTriggerStageId is required');
  }

  const valid = errors.length === 0;
  const liveExecutionReady =
    valid && target.manualCrmPreparationConfirmed === true;

  return liveSmokeTargetValidationSchema.parse({
    valid,
    testDealLabelStartsWithTestPrefix,
    liveExecutionReady,
    errors,
  });
}
