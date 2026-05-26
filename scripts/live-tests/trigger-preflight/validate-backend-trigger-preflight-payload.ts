import { hasTestDealPrefix } from '../fixtures/fixture-common';
import { isIso8601Timestamp } from '../report/normalize-dry-run-report';
import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { BitrixTriggerRequestPayload } from './backend-trigger-preflight.types';

export type BackendTriggerPayloadValidationCode =
  | 'SCENARIO_TYPE_MISMATCH'
  | 'TRIGGER_DEAL_ID_INVALID'
  | 'TRIGGER_SOURCE_INVALID'
  | 'TRIGGER_STAGE_MISSING'
  | 'TRIGGER_TIMESTAMP_INVALID'
  | 'ADVANCE_AMOUNT_MISSING'
  | 'FINAL_PRIOR_ADVANCE_MISSING';

export interface BackendTriggerPayloadValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBackendTriggerPreflightPayload(
  contract: BackendDryRunContract,
  payload: BitrixTriggerRequestPayload,
): BackendTriggerPayloadValidationResult {
  const errors: string[] = [];

  if (contract.scenarioType !== contract.expectedInvoiceType) {
    errors.push('scenarioType must match expectedInvoiceType from contract');
  }

  if (payload.bitrix_deal_id !== contract.trigger.bitrix_deal_id) {
    errors.push('Preflight payload bitrix_deal_id must match contract trigger');
  }

  if (!hasTestDealPrefix(payload.bitrix_deal_id)) {
    errors.push('payload.bitrix_deal_id must start with [TEST]');
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
