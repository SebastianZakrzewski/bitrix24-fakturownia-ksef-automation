import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import { validateBackendDryRunContract } from '../contracts/validate-backend-dry-run-contract';
import type { BackendSmokeContractValidationStatus } from './backend-smoke-readiness.types';

export interface BitrixTriggerContractCompatibility {
  compatibleWithBitrixTriggerRequestDto: boolean;
  contractValidationStatus: BackendSmokeContractValidationStatus;
}

/**
 * Checks dry-run contract against documented BitrixTriggerRequestDto shape
 * (`/docs/contracts.md`) without calling the backend.
 */
export function assessBitrixTriggerContractCompatibility(
  contract: BackendDryRunContract,
): BitrixTriggerContractCompatibility {
  try {
    validateBackendDryRunContract(contract);

    const trigger = contract.trigger;
    const dtoCompatible =
      typeof trigger.bitrix_deal_id === 'string' &&
      trigger.bitrix_deal_id.length > 0 &&
      trigger.trigger_source === 'BITRIX24_STAGE_CHANGE' &&
      typeof trigger.trigger_stage_id === 'string' &&
      trigger.trigger_stage_id.length > 0 &&
      typeof trigger.triggered_at === 'string' &&
      trigger.triggered_at.length > 0;

    if (!dtoCompatible) {
      return {
        compatibleWithBitrixTriggerRequestDto: false,
        contractValidationStatus: 'FAILED',
      };
    }

    return {
      compatibleWithBitrixTriggerRequestDto: true,
      contractValidationStatus: 'PASSED',
    };
  } catch {
    return {
      compatibleWithBitrixTriggerRequestDto: false,
      contractValidationStatus: 'FAILED',
    };
  }
}
