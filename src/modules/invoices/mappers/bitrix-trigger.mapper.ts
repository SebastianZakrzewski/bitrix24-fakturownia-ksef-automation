import { CreateInvoiceFromBitrixDealCommand } from '../commands/create-invoice-from-bitrix-deal.command';
import { BitrixTriggerRequestDto } from '../dto/bitrix-trigger-request.dto';

export function mapBitrixTriggerRequestToCommand(
  dto: BitrixTriggerRequestDto,
): CreateInvoiceFromBitrixDealCommand {
  return {
    bitrixDealId: dto.bitrix_deal_id,
    triggerSource: dto.trigger_source,
    triggerStageId: dto.trigger_stage_id,
    triggeredAt: dto.triggered_at,
  };
}
