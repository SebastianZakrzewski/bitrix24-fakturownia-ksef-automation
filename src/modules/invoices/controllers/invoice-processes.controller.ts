import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { N8nApiKeyGuard } from '../../../common/guards/n8n-api-key.guard';
import { BitrixTriggerRequestDto } from '../dto/bitrix-trigger-request.dto';
import { InvoiceProcessTriggerResponseDto } from '../dto/invoice-process-trigger-response.dto';
import { mapBitrixTriggerRequestToCommand } from '../mappers/bitrix-trigger.mapper';
import { CreateInvoiceFromBitrixDealUseCase } from '../use-cases/create-invoice-from-bitrix-deal.use-case';

@Controller('invoice-processes')
export class InvoiceProcessesController {
  constructor(
    private readonly createInvoiceFromBitrixDealUseCase: CreateInvoiceFromBitrixDealUseCase,
  ) {}

  @Post('bitrix-trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(N8nApiKeyGuard)
  bitrixTrigger(
    @Body() dto: BitrixTriggerRequestDto,
  ): InvoiceProcessTriggerResponseDto {
    const command = mapBitrixTriggerRequestToCommand(dto);

    return this.createInvoiceFromBitrixDealUseCase.execute(command);
  }
}
