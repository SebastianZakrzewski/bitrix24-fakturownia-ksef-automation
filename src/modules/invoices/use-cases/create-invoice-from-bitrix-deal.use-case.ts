import { Injectable, NotFoundException } from '@nestjs/common';
import { Bitrix24CompanyService } from '../../bitrix24/services/bitrix24-company.service';
import { Bitrix24DealService } from '../../bitrix24/services/bitrix24-deal.service';
import { Bitrix24ProductRowService } from '../../bitrix24/services/bitrix24-product-row.service';
import type {
  BitrixDealCore,
  BitrixDealData,
  BitrixProductRow,
} from '../../bitrix24/types/bitrix24.types';
import { CreateInvoiceFromBitrixDealCommand } from '../commands/create-invoice-from-bitrix-deal.command';
import { InvoiceProcessTriggerResponseDto } from '../dto/invoice-process-trigger-response.dto';
import { InvoiceCreationBlockedError } from '../errors/invoice-process.errors';
import { FakturowniaApiError } from '../integrations/fakturownia/fakturownia.errors';
import { FakturowniaService } from '../integrations/fakturownia/fakturownia.service';
import type { FakturowniaInvoiceOrderLinkage } from '../integrations/fakturownia/fakturownia.types';
import { BitrixInvoiceMapper } from '../mappers/bitrix-invoice.mapper';
import type { ClientConfigRow } from '../persistence/client-config.persistence';
import type { InvoiceProcessRow } from '../persistence/invoice-process.persistence';
import { BitrixDealSnapshotRepository } from '../repositories/bitrix-deal-snapshot.repository';
import { ClientConfigRepository } from '../repositories/client-config.repository';
import { InvoiceEventRepository } from '../repositories/invoice-event.repository';
import { InvoiceProcessRepository } from '../repositories/invoice-process.repository';
import { InvoiceRecordRepository } from '../repositories/invoice-record.repository';
import { FakturowniaOrderEnsureService } from '../services/fakturownia-order-ensure.service';
import { InvoiceDraftBuilderService } from '../services/invoice-draft-builder.service';
import { InvoiceIdempotencyService } from '../services/invoice-idempotency.service';
import { InvoiceProcessService } from '../services/invoice-process.service';
import { InvoiceValidationService } from '../services/invoice-validation.service';
import type { ClientConfigMappings } from '../types/client-config.types';
import type { ValidatedInvoiceMapping } from '../types/invoice-mapping.types';
import type { InvoiceProcessStatus, InvoiceType, ValidationError } from '../types/invoice.types';

@Injectable()
export class CreateInvoiceFromBitrixDealUseCase {
  constructor(
    private readonly clientConfigRepository: ClientConfigRepository,
    private readonly bitrix24DealService: Bitrix24DealService,
    private readonly bitrix24CompanyService: Bitrix24CompanyService,
    private readonly bitrix24ProductRowService: Bitrix24ProductRowService,
    private readonly invoiceIdempotencyService: InvoiceIdempotencyService,
    private readonly bitrixInvoiceMapper: BitrixInvoiceMapper,
    private readonly invoiceValidationService: InvoiceValidationService,
    private readonly invoiceProcessService: InvoiceProcessService,
    private readonly invoiceProcessRepository: InvoiceProcessRepository,
    private readonly invoiceEventRepository: InvoiceEventRepository,
    private readonly bitrixDealSnapshotRepository: BitrixDealSnapshotRepository,
    private readonly invoiceRecordRepository: InvoiceRecordRepository,
    private readonly invoiceDraftBuilderService: InvoiceDraftBuilderService,
    private readonly fakturowniaOrderEnsureService: FakturowniaOrderEnsureService,
    private readonly fakturowniaService: FakturowniaService,
  ) {}

  async execute(
    command: CreateInvoiceFromBitrixDealCommand,
  ): Promise<InvoiceProcessTriggerResponseDto> {
    const configRow = await this.clientConfigRepository.getActive();

    if (!configRow) {
      throw new NotFoundException('Active client configuration not found');
    }

    const config = this.toClientConfigMappings(configRow);

    const dealCore = await this.bitrix24DealService.getDealById(command.bitrixDealId);
    const productRows = await this.bitrix24ProductRowService.listByDealId(
      command.bitrixDealId,
    );
    const deal = this.buildBitrixDealData(dealCore, productRows);

    if (deal.stageId !== config.bitrix_paid_stage_id) {
      await this.invoiceEventRepository.insert({
        invoice_process_id: null,
        bitrix_deal_id: command.bitrixDealId,
        event_type: 'STALE_TRIGGER_IGNORED',
        message: 'Trigger ignored because deal is no longer on paid stage.',
        metadata: {
          current_stage_id: deal.stageId,
          expected_paid_stage_id: config.bitrix_paid_stage_id,
          trigger_stage_id: command.triggerStageId,
          triggered_at: command.triggeredAt,
        },
      });

      return {
        status: 'STALE_TRIGGER_IGNORED',
        bitrix_deal_id: command.bitrixDealId,
        message: 'Trigger ignored because deal is no longer on paid stage.',
      };
    }

    const preliminaryMapping = this.bitrixInvoiceMapper.map(deal, undefined, config);
    const invoiceType = preliminaryMapping.invoiceType;

    if (invoiceType === undefined) {
      return {
        status: 'VALIDATION_FAILED',
        bitrix_deal_id: command.bitrixDealId,
        message:
          'Invoice type is missing or could not be resolved from Bitrix deal fields.',
      };
    }

    const process = await this.invoiceIdempotencyService.claim(
      command.bitrixDealId,
      invoiceType,
    );

    if (process.status !== 'TRIGGER_RECEIVED') {
      return this.buildExistingProcessResponse(process, command.bitrixDealId);
    }

    const company = deal.companyId
      ? await this.bitrix24CompanyService.getCompanyById(deal.companyId, {
          addressSource: config.bitrix_field_mapping.companyAddressSource,
        })
      : undefined;

    const mapping = this.bitrixInvoiceMapper.map(deal, company, config);

    await this.bitrixDealSnapshotRepository.insert({
      invoice_process_id: process.id,
      bitrix_deal_id: deal.dealId,
      bitrix_company_id: deal.companyId ?? null,
      raw_deal: dealCore as unknown as Record<string, unknown>,
      raw_company: company ? (company as unknown as Record<string, unknown>) : null,
      raw_product_rows: productRows as unknown as Record<string, unknown>[],
      extracted_invoice_type: mapping.invoiceType ?? null,
      extracted_advance_amount:
        mapping.advanceAmount !== undefined ? String(mapping.advanceAmount) : null,
      extracted_products: mapping.products as unknown as Record<string, unknown>[],
    });

    const validationContext =
      invoiceType === 'FINAL'
        ? {
            previousAdvanceInvoiceId: await this.resolvePreviousAdvanceInvoiceId(
              command.bitrixDealId,
            ),
          }
        : {};

    const validationResult = this.invoiceValidationService.validate(
      mapping,
      config,
      validationContext,
    );

    if (!validationResult.ok) {
      return this.handleValidationFailure(
        process,
        validationResult.errors,
        invoiceType,
        command.bitrixDealId,
      );
    }

    return this.handleInvoiceCreation(
      process,
      validationResult.data,
      invoiceType,
      command.bitrixDealId,
    );
  }

  private toClientConfigMappings(row: ClientConfigRow): ClientConfigMappings {
    return {
      bitrix_paid_stage_id: row.bitrix_paid_stage_id,
      bitrix_field_mapping: row.bitrix_field_mapping,
      invoice_type_mapping: row.invoice_type_mapping,
    };
  }

  private buildBitrixDealData(
    dealCore: BitrixDealCore,
    productRows: BitrixProductRow[],
  ): BitrixDealData {
    return {
      dealId: dealCore.dealId,
      dealUrl: dealCore.dealUrl,
      stageId: dealCore.stageId,
      companyId: dealCore.companyId,
      customFields: dealCore.customFields,
      productRows,
    };
  }

  private async resolvePreviousAdvanceInvoiceId(
    bitrixDealId: string,
  ): Promise<string | undefined> {
    const advanceProcess =
      await this.invoiceProcessRepository.findByDealIdAndInvoiceType(
        bitrixDealId,
        'ADVANCE',
      );

    if (!advanceProcess) {
      return undefined;
    }

    const record = await this.invoiceRecordRepository.findByInvoiceProcessId(
      advanceProcess.id,
    );

    return record?.fakturownia_invoice_id;
  }

  private async handleInvoiceCreation(
    process: InvoiceProcessRow,
    validated: ValidatedInvoiceMapping,
    invoiceType: InvoiceType,
    bitrixDealId: string,
  ): Promise<InvoiceProcessTriggerResponseDto> {
    const draft = this.invoiceDraftBuilderService.build(validated);

    try {
      await this.invoiceIdempotencyService.assertCanCreateInvoice(process.id);
    } catch (error) {
      if (error instanceof InvoiceCreationBlockedError) {
        return {
          process_id: process.id,
          status: process.status,
          bitrix_deal_id: bitrixDealId,
          invoice_type: invoiceType,
          message: error.message,
        };
      }

      throw error;
    }

    this.invoiceProcessService.assertCanTransition(
      process.status,
      'INVOICE_CREATION_IN_PROGRESS',
    );

    await this.invoiceProcessRepository.updateStatus(process.id, {
      status: 'INVOICE_CREATION_IN_PROGRESS',
    });

    await this.invoiceEventRepository.insert({
      invoice_process_id: process.id,
      bitrix_deal_id: bitrixDealId,
      event_type: 'INVOICE_CREATION_IN_PROGRESS',
      message: 'Invoice creation started.',
    });

    try {
      let orderLinkage: FakturowniaInvoiceOrderLinkage | undefined;

      if (invoiceType === 'ADVANCE' || invoiceType === 'FINAL') {
        const orderRow = await this.fakturowniaOrderEnsureService.ensureForDeal({
          invoiceDraft: draft,
          invoiceProcessId: process.id,
        });
        orderLinkage = {
          fakturowniaOrderId: orderRow.fakturownia_order_id,
          fakturowniaOrderNumber: orderRow.fakturownia_order_number,
        };
      }

      const result = await this.fakturowniaService.createInvoice(draft, orderLinkage);

      await this.invoiceRecordRepository.insert({
        invoice_process_id: process.id,
        bitrix_deal_id: bitrixDealId,
        invoice_type: invoiceType,
        fakturownia_invoice_id: result.fakturowniaInvoiceId,
        fakturownia_invoice_url: result.fakturowniaInvoiceUrl,
        total_net: String(result.totalNet),
        total_gross: String(result.totalGross),
        vat_rate: draft.vatRate,
        currency: result.currency,
      });

      this.invoiceProcessService.assertCanTransition(
        'INVOICE_CREATION_IN_PROGRESS',
        'INVOICE_CREATED',
      );

      await this.invoiceProcessRepository.updateStatus(process.id, {
        status: 'INVOICE_CREATED',
      });

      await this.invoiceEventRepository.insert({
        invoice_process_id: process.id,
        bitrix_deal_id: bitrixDealId,
        event_type: 'INVOICE_CREATED',
        message: 'Invoice created successfully in Fakturownia.',
        metadata: {
          fakturownia_invoice_id: result.fakturowniaInvoiceId,
          fakturownia_invoice_url: result.fakturowniaInvoiceUrl,
        },
      });

      return {
        process_id: process.id,
        status: 'INVOICE_CREATED',
        bitrix_deal_id: bitrixDealId,
        invoice_type: invoiceType,
        message: 'Invoice created successfully in Fakturownia.',
      };
    } catch (error) {
      if (error instanceof FakturowniaApiError) {
        return this.handleFakturowniaError(process.id, bitrixDealId, invoiceType, error);
      }

      throw error;
    }
  }

  private async handleFakturowniaError(
    processId: string,
    bitrixDealId: string,
    invoiceType: InvoiceType,
    error: FakturowniaApiError,
  ): Promise<InvoiceProcessTriggerResponseDto> {
    const status = this.mapFakturowniaErrorToStatus(error.category);

    this.invoiceProcessService.assertCanTransition(
      'INVOICE_CREATION_IN_PROGRESS',
      status,
    );

    await this.invoiceProcessRepository.updateStatus(processId, {
      status,
      last_error_message: error.message,
    });

    await this.invoiceEventRepository.insert({
      invoice_process_id: processId,
      bitrix_deal_id: bitrixDealId,
      event_type: status,
      message: error.message,
      metadata: {
        category: error.category,
        httpStatus: error.httpStatus,
      },
    });

    return {
      process_id: processId,
      status,
      bitrix_deal_id: bitrixDealId,
      invoice_type: invoiceType,
      message: error.message,
    };
  }

  private mapFakturowniaErrorToStatus(
    category: FakturowniaApiError['category'],
  ): InvoiceProcessStatus {
    if (category === 'CLIENT' || category === 'SERVER') {
      return 'FAKTUROWNIA_ERROR';
    }

    return 'UNKNOWN_AFTER_TIMEOUT';
  }

  private async handleValidationFailure(
    process: InvoiceProcessRow,
    errors: ValidationError[],
    invoiceType: InvoiceType,
    bitrixDealId: string,
  ): Promise<InvoiceProcessTriggerResponseDto> {
    const message = this.buildValidationFailureMessage(errors);

    this.invoiceProcessService.assertCanTransition(process.status, 'VALIDATION_FAILED');

    await this.invoiceProcessRepository.updateStatus(process.id, {
      status: 'VALIDATION_FAILED',
      validation_errors: errors,
      last_error_message: message,
    });

    await this.invoiceEventRepository.insert({
      invoice_process_id: process.id,
      bitrix_deal_id: bitrixDealId,
      event_type: 'VALIDATION_FAILED',
      message,
      metadata: { errors },
    });

    return {
      process_id: process.id,
      status: 'VALIDATION_FAILED',
      bitrix_deal_id: bitrixDealId,
      invoice_type: invoiceType,
      message,
    };
  }

  private buildValidationFailureMessage(errors: ValidationError[]): string {
    if (errors.length === 1) {
      return errors[0].message;
    }

    return `Invoice validation failed with ${errors.length} errors.`;
  }

  private buildExistingProcessResponse(
    process: InvoiceProcessRow,
    bitrixDealId: string,
  ): InvoiceProcessTriggerResponseDto {
    return {
      process_id: process.id,
      status: process.status,
      bitrix_deal_id: bitrixDealId,
      invoice_type: process.invoice_type,
      message: `Invoice process already exists with status ${process.status}.`,
    };
  }
}
