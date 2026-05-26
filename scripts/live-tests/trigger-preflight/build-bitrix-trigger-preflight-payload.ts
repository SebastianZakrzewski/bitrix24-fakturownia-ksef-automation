import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import {
  bitrixTriggerRequestPayloadSchema,
  type BitrixTriggerRequestPayload,
} from './backend-trigger-preflight.types';

/**
 * Builds documented BitrixTriggerRequestDto payload from dry-run contract only.
 * Does not send HTTP requests.
 */
export function buildBitrixTriggerPreflightPayload(
  contract: BackendDryRunContract,
): BitrixTriggerRequestPayload {
  return bitrixTriggerRequestPayloadSchema.parse({
    bitrix_deal_id: contract.trigger.bitrix_deal_id,
    trigger_source: contract.trigger.trigger_source,
    trigger_stage_id: contract.trigger.trigger_stage_id,
    triggered_at: contract.trigger.triggered_at,
  });
}
