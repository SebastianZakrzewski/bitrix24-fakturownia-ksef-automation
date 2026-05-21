import { Injectable } from '@nestjs/common';
import type { ClientBitrixFieldMapping, ClientConfigMappings } from '../types/client-config.types';
import type {
  BitrixInvoiceMappingResult,
  InvoiceValidationContext,
  InvoiceValidationResult,
  MappedBuyer,
  ValidatedInvoiceMapping,
} from '../types/invoice-mapping.types';
import type { ProductLine, ValidationError } from '../types/invoice.types';

@Injectable()
export class InvoiceValidationService {
  validate(
    mapping: BitrixInvoiceMappingResult,
    config: ClientConfigMappings,
    context: InvoiceValidationContext = {},
  ): InvoiceValidationResult {
    const errors: ValidationError[] = [];
    const fieldMapping = config.bitrix_field_mapping;

    this.validateDocumentAndInvoiceType(
      mapping.dealCustomFields,
      mapping.invoiceType,
      fieldMapping,
      errors,
    );
    this.validateBuyer(mapping.buyer, errors);
    this.validateProducts(mapping.products, errors);

    if (mapping.invoiceType === 'ADVANCE') {
      this.validateAdvanceAmount(mapping.advanceAmount, errors);
    }

    if (mapping.invoiceType === 'FINAL') {
      this.validatePreviousAdvanceInvoice(context.previousAdvanceInvoiceId, errors);
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    const data: ValidatedInvoiceMapping = {
      bitrixDealId: mapping.bitrixDealId,
      invoiceType: mapping.invoiceType!,
      buyer: {
        companyName: mapping.buyer.companyName!.trim(),
        nip: mapping.buyer.nip!.trim(),
        street: mapping.buyer.street!.trim(),
        postalCode: mapping.buyer.postalCode!.trim(),
        city: mapping.buyer.city!.trim(),
        country: mapping.buyer.country!.trim(),
      },
      products: mapping.products,
      ...(mapping.invoiceType === 'ADVANCE' && mapping.advanceAmount !== undefined
        ? { advanceAmount: mapping.advanceAmount }
        : {}),
      ...(mapping.invoiceType === 'FINAL' && context.previousAdvanceInvoiceId
        ? { previousAdvanceInvoiceId: context.previousAdvanceInvoiceId }
        : {}),
    };

    return { ok: true, data };
  }

  private validateDocumentAndInvoiceType(
    customFields: Record<string, unknown>,
    invoiceType: BitrixInvoiceMappingResult['invoiceType'],
    fieldMapping: ClientBitrixFieldMapping,
    errors: ValidationError[],
  ): void {
    const documentType = this.readFieldValue(customFields, fieldMapping.documentTypeField);

    if (documentType !== fieldMapping.documentTypeInvoiceValueId) {
      errors.push(
        this.error(
          'MISSING_INVOICE_TYPE',
          'Deal document type must be Faktura for invoice creation.',
          fieldMapping.documentTypeField,
          'BITRIX_DEAL',
        ),
      );
    }

    const invoiceDocumentType = this.readFieldValue(
      customFields,
      fieldMapping.invoiceDocumentTypeField,
    );

    if (invoiceDocumentType === fieldMapping.invoiceDocumentTypeCorrectionValueId) {
      errors.push(
        this.error(
          'MISSING_INVOICE_TYPE',
          'Corrective invoice type is not supported in V1.',
          fieldMapping.invoiceDocumentTypeField,
          'BITRIX_DEAL',
        ),
      );
    }

    if (invoiceType === undefined) {
      errors.push(
        this.error(
          'MISSING_INVOICE_TYPE',
          'Invoice type is missing or could not be resolved from Bitrix deal fields.',
          fieldMapping.paymentFormField,
          'BITRIX_DEAL',
        ),
      );
    }
  }

  private validateBuyer(buyer: MappedBuyer, errors: ValidationError[]): void {
    if (!buyer.companyId) {
      errors.push(
        this.error(
          'MISSING_COMPANY',
          'Deal is not linked to a Bitrix company.',
          'companyId',
          'BITRIX_DEAL',
        ),
      );
      return;
    }

    if (!buyer.companyName?.trim()) {
      errors.push(
        this.error(
          'MISSING_COMPANY_NAME',
          'Company name is required for invoice buyer.',
          'companyName',
          'BITRIX_COMPANY',
        ),
      );
    }

    if (!buyer.nip?.trim()) {
      errors.push(
        this.error(
          'MISSING_NIP',
          'Company NIP is required for invoice buyer.',
          'nip',
          'BITRIX_COMPANY',
        ),
      );
    }

    const addressFields: Array<{
      key: keyof Pick<MappedBuyer, 'street' | 'postalCode' | 'city' | 'country'>;
      label: string;
    }> = [
      { key: 'street', label: 'street' },
      { key: 'postalCode', label: 'postalCode' },
      { key: 'city', label: 'city' },
      { key: 'country', label: 'country' },
    ];

    for (const { key, label } of addressFields) {
      if (!buyer[key]?.trim()) {
        errors.push(
          this.error(
            'MISSING_COMPANY_ADDRESS',
            `Company ${label} is required for invoice buyer.`,
            label,
            'BITRIX_COMPANY',
          ),
        );
      }
    }
  }

  private validateProducts(products: ProductLine[], errors: ValidationError[]): void {
    if (products.length === 0) {
      errors.push(
        this.error(
          'MISSING_PRODUCTS',
          'At least one valid product line is required.',
          'products',
          'PRODUCT_MAPPING',
        ),
      );
      return;
    }

    for (const line of products) {
      if (!line.name.trim()) {
        errors.push(
          this.error(
            'INVALID_PRODUCT_LINE',
            'Product line name must not be empty.',
            line.sourceId ?? 'name',
            'PRODUCT_MAPPING',
          ),
        );
      }

      if (line.quantity <= 0) {
        errors.push(
          this.error(
            'INVALID_PRODUCT_LINE',
            'Product line quantity must be greater than zero.',
            line.sourceId ?? 'quantity',
            'PRODUCT_MAPPING',
          ),
        );
      }

      if (line.unitGrossPrice <= 0) {
        errors.push(
          this.error(
            'INVALID_PRODUCT_LINE',
            'Product line unit gross price must be greater than zero.',
            line.sourceId ?? 'unitGrossPrice',
            'PRODUCT_MAPPING',
          ),
        );
      }

      if (line.totalGross <= 0) {
        errors.push(
          this.error(
            'INVALID_PRODUCT_LINE',
            'Product line total gross must be greater than zero.',
            line.sourceId ?? 'totalGross',
            'PRODUCT_MAPPING',
          ),
        );
      }
    }
  }

  private validateAdvanceAmount(
    advanceAmount: number | undefined,
    errors: ValidationError[],
  ): void {
    if (advanceAmount === undefined) {
      errors.push(
        this.error(
          'MISSING_ADVANCE_AMOUNT',
          'Advance amount is required for ADVANCE invoice type.',
          'advanceAmount',
          'BITRIX_DEAL',
        ),
      );
      return;
    }

    if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
      errors.push(
        this.error(
          'INVALID_ADVANCE_AMOUNT',
          'Advance amount must be a positive number.',
          'advanceAmount',
          'BITRIX_DEAL',
        ),
      );
    }
  }

  private validatePreviousAdvanceInvoice(
    previousAdvanceInvoiceId: string | undefined,
    errors: ValidationError[],
  ): void {
    if (!previousAdvanceInvoiceId?.trim()) {
      errors.push(
        this.error(
          'MISSING_PREVIOUS_ADVANCE_INVOICE',
          'A previous successful ADVANCE invoice record is required for FINAL invoice type.',
          'previousAdvanceInvoiceId',
          'INVOICE_RULE',
        ),
      );
    }
  }

  private readFieldValue(
    customFields: Record<string, unknown>,
    fieldCode: string,
  ): string | undefined {
    const raw = customFields[fieldCode];

    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }

    return String(raw);
  }

  private error(
    code: ValidationError['code'],
    message: string,
    field?: string,
    source?: ValidationError['source'],
  ): ValidationError {
    return { code, message, field, source };
  }
}
