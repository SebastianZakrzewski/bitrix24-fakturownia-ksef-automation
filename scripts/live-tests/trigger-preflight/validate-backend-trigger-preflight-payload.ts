import { isIso8601Timestamp } from '../report/normalize-dry-run-report';
import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { LiveSmokeTarget } from '../live-smoke-target/live-smoke-target.types';
import type { LiveSmokeTargetValidation } from '../live-smoke-target/live-smoke-target.types';
import type { BitrixTriggerRequestPayload } from './backend-trigger-preflight.types';

export interface BackendTriggerPayloadValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBackendTriggerPreflightPayload(
  contract: BackendDryRunContract,
  liveSmokeTarget: LiveSmokeTarget,
  liveSmokeTargetValidation: LiveSmokeTargetValidation,
  payload: BitrixTriggerRequestPayload,
): BackendTriggerPayloadValidationResult {
  const errors: string[] = [...liveSmokeTargetValidation.errors];

  if (!liveSmokeTargetValidation.valid) {
    return { valid: false, errors };
  }

  if (contract.scenarioType !== contract.expectedInvoiceType) {
    errors.push('scenarioType must match expectedInvoiceType from contract');
  }

  if (payload.bitrix_deal_id !== liveSmokeTarget.actualBitrixDealId) {
    errors.push('payload.bitrix_deal_id must equal actualBitrixDealId');
  }

  if (payload.trigger_stage_id !== liveSmokeTarget.expectedTriggerStageId) {
    errors.push('payload.trigger_stage_id must equal expectedTriggerStageId');
  }

  if (payload.trigger_source !== 'BITRIX24_STAGE_CHANGE') {
    errors.push('payload.trigger_source must be BITRIX24_STAGE_CHANGE');
  }

  if (!payload.trigger_stage_id.trim()) {
    errors.push('payload.trigger_stage_id is required');
  }

  if (!isIso8601Timestamp(payload.triggered_at)) {
    errors.push('payload.triggered_at must be a valid ISO-8601 timestamp');
  }

  switch (contract.scenarioType) {
    case 'ADVANCE':
      if (!contract.fixtureContext.hasAdvanceAmount) {
        errors.push('ADVANCE preflight requires fixture advance amount');
      }
      break;
    case 'FINAL':
      if (!contract.fixtureContext.hasPreviousAdvanceInvoiceId) {
        errors.push('FINAL preflight requires prior advance reference in fixture');
      }
      break;
    case 'FULL':
      if (
        contract.fixtureContext.hasAdvanceAmount ||
        contract.fixtureContext.hasPreviousAdvanceInvoiceId
      ) {
        errors.push('FULL preflight must not include advance-only fixture flags');
      }
      break;
    default: {
      const exhaustive: never = contract.scenarioType;
      errors.push(`Unsupported scenario type: ${exhaustive}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
