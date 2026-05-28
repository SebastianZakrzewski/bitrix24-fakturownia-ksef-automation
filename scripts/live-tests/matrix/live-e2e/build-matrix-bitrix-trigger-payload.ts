import type { BitrixTriggerExecutionPayload } from '../../trigger-execution/backend-trigger-execution.types';

export interface BuildMatrixBitrixTriggerPayloadInput {
  bitrixDealId: string;
  paidStageId: string;
  triggeredAt?: string;
}

/**
 * Builds documented BitrixTriggerRequestDto for matrix live E2E backend trigger.
 */
export function buildMatrixBitrixTriggerPayload(
  input: BuildMatrixBitrixTriggerPayloadInput,
): BitrixTriggerExecutionPayload {
  return {
    bitrix_deal_id: input.bitrixDealId,
    trigger_source: 'BITRIX24_STAGE_CHANGE',
    trigger_stage_id: input.paidStageId,
    triggered_at: input.triggeredAt ?? new Date().toISOString(),
  };
}
