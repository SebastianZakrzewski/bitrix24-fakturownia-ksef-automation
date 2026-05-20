import { Injectable } from '@nestjs/common';
import { CreateInvoiceFromBitrixDealCommand } from '../commands/create-invoice-from-bitrix-deal.command';
import { InvoiceProcessTriggerResponseDto } from '../dto/invoice-process-trigger-response.dto';

@Injectable()
export class CreateInvoiceFromBitrixDealUseCase {
  execute(
    command: CreateInvoiceFromBitrixDealCommand,
  ): InvoiceProcessTriggerResponseDto {
    return {
      status: 'TRIGGER_RECEIVED',
      bitrix_deal_id: command.bitrixDealId,
      message:
        'Trigger accepted by V1 skeleton. Invoice workflow is not implemented in this task.',
    };
  }
}
