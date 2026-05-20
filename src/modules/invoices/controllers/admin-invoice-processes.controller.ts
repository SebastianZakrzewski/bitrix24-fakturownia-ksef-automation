import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../../common/guards/admin-api-key.guard';
import { TechnicalRetryRequestDto } from '../dto/technical-retry-request.dto';
import { TechnicalRetryService } from '../services/technical-retry.service';

@Controller('admin/invoice-processes')
@UseGuards(AdminApiKeyGuard)
export class AdminInvoiceProcessesController {
  constructor(private readonly technicalRetryService: TechnicalRetryService) {}

  @Post(':id/retry')
  retry(
    @Param('id') invoiceProcessId: string,
    @Body() dto: TechnicalRetryRequestDto,
  ): void {
    this.technicalRetryService.evaluateRetry(invoiceProcessId, dto);
  }

  @Post(':id/mark-reviewed')
  markReviewed(@Param('id') invoiceProcessId: string): void {
    this.technicalRetryService.markReviewed(invoiceProcessId);
  }
}
