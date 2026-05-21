import { Module } from '@nestjs/common';
import { Bitrix24Module } from '../bitrix24/bitrix24.module';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { N8nApiKeyGuard } from '../../common/guards/n8n-api-key.guard';
import { AdminInvoiceProcessesController } from './controllers/admin-invoice-processes.controller';
import { InvoiceProcessesController } from './controllers/invoice-processes.controller';
import { FakturowniaClient } from './integrations/fakturownia/fakturownia.client';
import { FakturowniaErrorMapper } from './integrations/fakturownia/fakturownia-error.mapper';
import { FakturowniaMapper } from './integrations/fakturownia/fakturownia.mapper';
import { FakturowniaOrderMapper } from './integrations/fakturownia/fakturownia-order.mapper';
import { FakturowniaOrderService } from './integrations/fakturownia/fakturownia-order.service';
import { FakturowniaService } from './integrations/fakturownia/fakturownia.service';
import { BitrixInvoiceMapper } from './mappers/bitrix-invoice.mapper';
import { BitrixDealSnapshotRepository } from './repositories/bitrix-deal-snapshot.repository';
import { ClientConfigRepository } from './repositories/client-config.repository';
import { InvoiceEventRepository } from './repositories/invoice-event.repository';
import { InvoiceProcessRepository } from './repositories/invoice-process.repository';
import { FakturowniaOrderRepository } from './repositories/fakturownia-order.repository';
import { InvoiceRecordRepository } from './repositories/invoice-record.repository';
import { TechnicalRetryAttemptRepository } from './repositories/technical-retry-attempt.repository';
import { InvoiceCommentService } from './services/invoice-comment.service';
import { InvoiceDraftBuilderService } from './services/invoice-draft-builder.service';
import { InvoiceIdempotencyService } from './services/invoice-idempotency.service';
import { InvoiceProcessService } from './services/invoice-process.service';
import { InvoiceValidationService } from './services/invoice-validation.service';
import { TechnicalRetryService } from './services/technical-retry.service';
import { CreateInvoiceFromBitrixDealUseCase } from './use-cases/create-invoice-from-bitrix-deal.use-case';

@Module({
  imports: [Bitrix24Module],
  controllers: [InvoiceProcessesController, AdminInvoiceProcessesController],
  providers: [
    N8nApiKeyGuard,
    AdminApiKeyGuard,
    CreateInvoiceFromBitrixDealUseCase,
    TechnicalRetryService,
    InvoiceProcessService,
    InvoiceValidationService,
    InvoiceDraftBuilderService,
    InvoiceIdempotencyService,
    InvoiceCommentService,
    BitrixInvoiceMapper,
    InvoiceProcessRepository,
    FakturowniaOrderRepository,
    InvoiceRecordRepository,
    InvoiceEventRepository,
    BitrixDealSnapshotRepository,
    ClientConfigRepository,
    TechnicalRetryAttemptRepository,
    FakturowniaClient,
    FakturowniaService,
    FakturowniaOrderService,
    FakturowniaMapper,
    FakturowniaOrderMapper,
    FakturowniaErrorMapper,
  ],
})
export class InvoicesModule {}
