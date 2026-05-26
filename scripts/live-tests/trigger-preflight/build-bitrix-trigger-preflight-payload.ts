import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { LiveSmokeTarget } from '../live-smoke-target/live-smoke-target.types';
import {
  bitrixTriggerRequestPayloadSchema,
  type BitrixTriggerRequestPayload,
} from './backend-trigger-preflight.types';

/**
 * Builds documented BitrixTriggerRequestDto payload for preflight.
 * Uses actualBitrixDealId from live smoke target (real numeric Bitrix ID when configured).
 * Does not send HTTP requests.
 */
export function buildBitrixTriggerPreflightPayload(
  contract: BackendDryRunContract,
  liveSmokeTarget: LiveSmokeTarget,
): BitrixTriggerRequestPayload {
  return bitrixTriggerRequestPayloadSchema.parse({
    bitrix_deal_id: liveSmokeTarget.actualBitrixDealId,
    trigger_source: contract.trigger.trigger_source,
    trigger_stage_id: liveSmokeTarget.expectedTriggerStageId,
    triggered_at: contract.trigger.triggered_at,
  });
}
