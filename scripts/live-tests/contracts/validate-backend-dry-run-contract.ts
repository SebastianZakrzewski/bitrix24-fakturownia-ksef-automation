import type {
  AdvanceLiveTestScenarioContext,
  FinalLiveTestScenarioContext,
} from '../fixtures/scenario-context.types';
import { hasTestDealPrefix } from '../fixtures/fixture-common';
import { isIso8601Timestamp } from '../report/normalize-dry-run-report';
import type { BackendDryRunContract } from './backend-dry-run-contract.types';

export type BackendDryRunContractValidationCode =
  | 'MODE_INVALID'
  | 'SCENARIO_TYPE_MISMATCH'
  | 'TRIGGER_DEAL_ID_INVALID'
  | 'TRIGGER_SOURCE_INVALID'
  | 'TRIGGER_STAGE_MISSING'
  | 'TRIGGER_TIMESTAMP_INVALID'
  | 'EXECUTION_POLICY_INVALID'
  | 'FIXTURE_SYNTHETIC_BUYER_MISSING'
  | 'FIXTURE_PRODUCTS_MISSING'
  | 'ADVANCE_AMOUNT_MISSING'
  | 'FINAL_PRIOR_ADVANCE_MISSING'
  | 'FULL_FIXTURE_INVALID';

export class BackendDryRunContractValidationError extends Error {
  readonly code: BackendDryRunContractValidationCode;

  constructor(code: BackendDryRunContractValidationCode, message: string) {
    super(message);
    this.name = 'BackendDryRunContractValidationError';
    this.code = code;
  }
}

export function validateBackendDryRunContract(
  contract: BackendDryRunContract,
): void {
  if (contract.mode !== 'DRY_RUN') {
    throw new BackendDryRunContractValidationError(
      'MODE_INVALID',
      'Contract mode must be DRY_RUN',
    );
  }

  if (contract.scenarioType !== contract.expectedInvoiceType) {
    throw new BackendDryRunContractValidationError(
      'SCENARIO_TYPE_MISMATCH',
      'scenarioType must match expectedInvoiceType',
    );
  }

  if (!hasTestDealPrefix(contract.trigger.bitrix_deal_id)) {
    throw new BackendDryRunContractValidationError(
      'TRIGGER_DEAL_ID_INVALID',
      'trigger.bitrix_deal_id must start with [TEST]',
    );
  }

  if (contract.trigger.trigger_source !== 'BITRIX24_STAGE_CHANGE') {
    throw new BackendDryRunContractValidationError(
      'TRIGGER_SOURCE_INVALID',
      'trigger.trigger_source must be BITRIX24_STAGE_CHANGE',
    );
  }

  if (!contract.trigger.trigger_stage_id.trim()) {
    throw new BackendDryRunContractValidationError(
      'TRIGGER_STAGE_MISSING',
      'trigger.trigger_stage_id is required',
    );
  }

  if (!isIso8601Timestamp(contract.trigger.triggered_at)) {
    throw new BackendDryRunContractValidationError(
      'TRIGGER_TIMESTAMP_INVALID',
      'trigger.triggered_at must be a valid ISO-8601 timestamp',
    );
  }

  const policy = contract.executionPolicy;
  if (
    policy.backendEndpointAllowed !== false ||
    policy.useCaseExecutionAllowed !== false ||
    policy.dbWriteAllowed !== false ||
    policy.externalSideEffectsAllowed !== false
  ) {
    throw new BackendDryRunContractValidationError(
      'EXECUTION_POLICY_INVALID',
      'execution policy must deny backend, use case, DB, and external side effects',
    );
  }

  if (!contract.fixtureContext.hasSyntheticBuyer) {
    throw new BackendDryRunContractValidationError(
      'FIXTURE_SYNTHETIC_BUYER_MISSING',
      'fixture must use synthetic buyer data',
    );
  }

  if (!contract.fixtureContext.hasProducts) {
    throw new BackendDryRunContractValidationError(
      'FIXTURE_PRODUCTS_MISSING',
      'fixture must include product lines',
    );
  }

  switch (contract.scenarioType) {
    case 'FULL':
      if (
        contract.fixtureContext.hasAdvanceAmount ||
        contract.fixtureContext.hasPreviousAdvanceInvoiceId
      ) {
        throw new BackendDryRunContractValidationError(
          'FULL_FIXTURE_INVALID',
          'FULL contract must not include advance or prior advance flags',
        );
      }
      break;
    case 'ADVANCE':
      if (!contract.fixtureContext.hasAdvanceAmount) {
        throw new BackendDryRunContractValidationError(
          'ADVANCE_AMOUNT_MISSING',
          'ADVANCE contract requires fixture advance amount',
        );
      }
      break;
    case 'FINAL':
      if (!contract.fixtureContext.hasPreviousAdvanceInvoiceId) {
        throw new BackendDryRunContractValidationError(
          'FINAL_PRIOR_ADVANCE_MISSING',
          'FINAL contract requires previousAdvanceInvoiceId or prior advance reference',
        );
      }
      break;
    default: {
      const exhaustive: never = contract.scenarioType;
      throw new BackendDryRunContractValidationError(
        'SCENARIO_TYPE_MISMATCH',
        `Unsupported scenario type: ${exhaustive}`,
      );
    }
  }
}

export function buildAndValidateBackendDryRunContract(
  contract: BackendDryRunContract,
): BackendDryRunContract {
  validateBackendDryRunContract(contract);
  return contract;
}

export function assertAdvanceContractFixture(
  context: AdvanceLiveTestScenarioContext,
): void {
  if (!context.advanceAmountPln) {
    throw new BackendDryRunContractValidationError(
      'ADVANCE_AMOUNT_MISSING',
      'ADVANCE fixture must include advanceAmountPln',
    );
  }
}

export function assertFinalContractFixture(
  context: FinalLiveTestScenarioContext,
): void {
  if (!context.previousAdvanceInvoiceId && !context.priorAdvanceProcessReference) {
    throw new BackendDryRunContractValidationError(
      'FINAL_PRIOR_ADVANCE_MISSING',
      'FINAL fixture must include previousAdvanceInvoiceId or priorAdvanceProcessReference',
    );
  }
}
