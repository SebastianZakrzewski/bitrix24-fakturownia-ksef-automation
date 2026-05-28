import { Injectable, NotFoundException } from '@nestjs/common';
import { Bitrix24DealFieldService } from '../../bitrix24/services/bitrix24-deal-field.service';
import { Bitrix24TimelineService } from '../../bitrix24/services/bitrix24-timeline.service';
import { Bitrix24CompanyService } from '../../bitrix24/services/bitrix24-company.service';
import { Bitrix24ContactService } from '../../bitrix24/services/bitrix24-contact.service';
import { Bitrix24DealService } from '../../bitrix24/services/bitrix24-deal.service';
import { Bitrix24ProductRowService } from '../../bitrix24/services/bitrix24-product-row.service';
import type {
  BitrixCompanyData,
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
import { InvoiceCommentService } from '../services/invoice-comment.service';
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
    private readonly bitrix24ContactService: Bitrix24ContactService,
    private readonly bitrix24ProductRowService: Bitrix24ProductRowService,
    private readonly bitrix24TimelineService: Bitrix24TimelineService,
    private readonly bitrix24DealFieldService: Bitrix24DealFieldService,
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
    private readonly invoiceCommentService: InvoiceCommentService,
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

    const company = await this.resolveCompanyForInvoiceMapping(
      dealCore,
      config,
    );

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
      config,
    );
  }

  private toClientConfigMappings(row: ClientConfigRow): ClientConfigMappings {
    return {
      bitrix_paid_stage_id: row.bitrix_paid_stage_id,
      bitrix_field_mapping: row.bitrix_field_mapping,
      invoice_type_mapping: row.invoice_type_mapping,
    };
  }

  private async resolveCompanyForInvoiceMapping(
    dealCore: BitrixDealCore,
    config: ClientConfigMappings,
  ): Promise<BitrixCompanyData | undefined> {
    const company = dealCore.companyId
      ? await this.bitrix24CompanyService.getCompanyById(dealCore.companyId, {
          addressSource: config.bitrix_field_mapping.companyAddressSource,
        })
      : undefined;

    if (!company) {
      return undefined;
    }

    const contactEmail = dealCore.contactId
      ? await this.bitrix24ContactService.getPrimaryEmailByContactId(
          dealCore.contactId,
        )
      : undefined;

    if (!contactEmail) {
      return company;
    }

    return {
      ...company,
      customerEmail: contactEmail,
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
      contactId: dealCore.contactId,
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
    config: ClientConfigMappings,
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

      return this.syncBitrixAfterInvoiceCreated({
        processId: process.id,
        bitrixDealId,
        invoiceType,
        config,
        fakturowniaInvoiceId: result.fakturowniaInvoiceId,
        fakturowniaInvoiceUrl: result.fakturowniaInvoiceUrl,
      });
    } catch (error) {
      if (error instanceof FakturowniaApiError) {
        return this.handleFakturowniaError(process.id, bitrixDealId, invoiceType, error);
      }

      throw error;
    }
  }

  private async syncBitrixAfterInvoiceCreated(params: {
    processId: string;
    bitrixDealId: string;
    invoiceType: InvoiceType;
    config: ClientConfigMappings;
    fakturowniaInvoiceId: string;
    fakturowniaInvoiceUrl: string;
  }): Promise<InvoiceProcessTriggerResponseDto> {
    const commentMessage = this.invoiceCommentService.buildInvoiceCreatedComment({
      invoiceType: params.invoiceType,
      fakturowniaInvoiceUrl: params.fakturowniaInvoiceUrl,
      fakturowniaInvoiceId: params.fakturowniaInvoiceId,
    });

    try {
      await this.bitrix24TimelineService.addDealComment({
        dealId: params.bitrixDealId,
        message: commentMessage,
      });
    } catch (error) {
      const failureMessage =
        error instanceof Error
          ? error.message
          : 'Bitrix24 timeline comment failed after invoice creation.';

      this.invoiceProcessService.assertCanTransition(
        'INVOICE_CREATED',
        'MANUAL_REVIEW_REQUIRED',
      );

      await this.invoiceProcessRepository.updateStatus(params.processId, {
        status: 'MANUAL_REVIEW_REQUIRED',
        last_error_message: failureMessage,
      });

      await this.invoiceEventRepository.insert({
        invoice_process_id: params.processId,
        bitrix_deal_id: params.bitrixDealId,
        event_type: 'BITRIX_TIMELINE_COMMENT_FAILED',
        message: failureMessage,
      });

      return {
        process_id: params.processId,
        status: 'MANUAL_REVIEW_REQUIRED',
        bitrix_deal_id: params.bitrixDealId,
        invoice_type: params.invoiceType,
        message:
          'Invoice created in Fakturownia, but Bitrix24 timeline comment failed. Manual review required.',
      };
    }

    await this.invoiceEventRepository.insert({
      invoice_process_id: params.processId,
      bitrix_deal_id: params.bitrixDealId,
      event_type: 'BITRIX_TIMELINE_COMMENT_ADDED',
      message: 'Bitrix24 timeline comment with invoice link added.',
      metadata: {
        fakturownia_invoice_url: params.fakturowniaInvoiceUrl,
      },
    });

    try {
      await this.bitrix24DealFieldService.updateDealField({
        dealId: params.bitrixDealId,
        fieldCode: params.config.bitrix_field_mapping.invoiceLinkField,
        value: params.fakturowniaInvoiceUrl,
      });

      await this.invoiceEventRepository.insert({
        invoice_process_id: params.processId,
        bitrix_deal_id: params.bitrixDealId,
        event_type: 'BITRIX_LINK_FIELD_UPDATED',
        message: 'Bitrix24 invoice link field updated.',
        metadata: {
          field_code: params.config.bitrix_field_mapping.invoiceLinkField,
          fakturownia_invoice_url: params.fakturowniaInvoiceUrl,
        },
      });
    } catch (error) {
      const warningMessage =
        error instanceof Error
          ? error.message
          : 'Bitrix24 invoice link field update failed.';

      await this.invoiceEventRepository.insert({
        invoice_process_id: params.processId,
        bitrix_deal_id: params.bitrixDealId,
        event_type: 'BITRIX_LINK_FIELD_UPDATE_FAILED',
        message: warningMessage,
        metadata: {
          field_code: params.config.bitrix_field_mapping.invoiceLinkField,
        },
      });
    }

    return {
      process_id: params.processId,
      status: 'INVOICE_CREATED',
      bitrix_deal_id: params.bitrixDealId,
      invoice_type: params.invoiceType,
      message:
        'Invoice created successfully in Fakturownia and synced to Bitrix24.',
    };
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

    await this.tryAddValidationFailureComment(process.id, bitrixDealId, errors);

    return {
      process_id: process.id,
      status: 'VALIDATION_FAILED',
      bitrix_deal_id: bitrixDealId,
      invoice_type: invoiceType,
      message,
    };
  }

  private async tryAddValidationFailureComment(
    processId: string,
    bitrixDealId: string,
    errors: ValidationError[],
  ): Promise<void> {
    const commentMessage = this.invoiceCommentService.buildValidationFailureComment({
      errors,
    });

    try {
      await this.bitrix24TimelineService.addDealComment({
        dealId: bitrixDealId,
        message: commentMessage,
      });
    } catch (error) {
      const warningMessage =
        error instanceof Error
          ? error.message
          : 'Bitrix24 validation failure comment failed.';

      await this.invoiceEventRepository.insert({
        invoice_process_id: processId,
        bitrix_deal_id: bitrixDealId,
        event_type: 'BITRIX_VALIDATION_COMMENT_FAILED',
        message: warningMessage,
      });
    }
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
