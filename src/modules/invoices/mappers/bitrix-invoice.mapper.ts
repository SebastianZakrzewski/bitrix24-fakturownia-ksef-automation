import { Injectable } from '@nestjs/common';
import type { BitrixCompanyData, BitrixDealData } from '../../bitrix24/types/bitrix24.types';
import type {
  ClientBitrixFieldMapping,
  ClientConfigMappings,
} from '../types/client-config.types';
import type {
  BitrixInvoiceMappingResult,
  MappedBuyer,
} from '../types/invoice-mapping.types';
import type { InvoiceType, ProductLine } from '../types/invoice.types';

@Injectable()
export class BitrixInvoiceMapper {
  map(
    deal: BitrixDealData,
    company: BitrixCompanyData | undefined,
    config: ClientConfigMappings,
  ): BitrixInvoiceMappingResult {
    const mapping = config.bitrix_field_mapping;
    const advanceAmount = this.parseAdvanceAmount(deal, mapping);

    return {
      bitrixDealId: deal.dealId,
      invoiceType: this.resolveInvoiceType(deal, mapping),
      buyer: this.mapBuyer(deal, company),
      products: this.mapProducts(deal, mapping),
      dealCustomFields: { ...deal.customFields },
      ...(advanceAmount !== undefined ? { advanceAmount } : {}),
    };
  }

  private resolveInvoiceType(
    deal: BitrixDealData,
    mapping: ClientBitrixFieldMapping,
  ): InvoiceType | undefined {
    const invoiceDocumentType = this.readCustomFieldValue(
      deal,
      mapping.invoiceDocumentTypeField,
    );
    const paymentForm = this.readCustomFieldValue(deal, mapping.paymentFormField);

    if (invoiceDocumentType === mapping.invoiceDocumentTypeCorrectionValueId) {
      return undefined;
    }

    if (invoiceDocumentType === mapping.invoiceDocumentTypeFinalValueId) {
      if (paymentForm === mapping.paymentFormFullValueId) {
        return 'FINAL';
      }

      return undefined;
    }

    if (paymentForm === mapping.paymentFormAdvanceValueId) {
      return 'ADVANCE';
    }

    if (paymentForm === mapping.paymentFormFullValueId) {
      return 'FULL';
    }

    return undefined;
  }

  private mapBuyer(
    deal: BitrixDealData,
    company: BitrixCompanyData | undefined,
  ): MappedBuyer {
    if (!deal.companyId || !company) {
      return {
        companyId: deal.companyId,
      };
    }

    return {
      companyId: company.companyId,
      companyName: company.name,
      nip: company.nip,
      street: company.street,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country,
      customerEmail: company.customerEmail,
    };
  }

  private mapProducts(
    deal: BitrixDealData,
    mapping: ClientBitrixFieldMapping,
  ): ProductLine[] {
    const rowLines = deal.productRows
      .map((row) => this.mapProductRow(row))
      .filter((line): line is ProductLine => line !== null);

    const shippingGross = this.parseShippingCost(deal, mapping);
    const opportunity = this.parseOpportunity(deal, mapping);
    const rowsTotalGross = rowLines.reduce((sum, line) => sum + line.totalGross, 0);
    const mainGross =
      rowLines.length === 0
        ? opportunity - shippingGross
        : opportunity - rowsTotalGross - shippingGross;

    const lines: ProductLine[] = [];

    if (mainGross > 0) {
      lines.push({
        source: 'DEAL_FIELDS',
        name: mapping.mainProductName,
        quantity: 1,
        unit: mapping.mainProductUnit as 'szt.',
        unitGrossPrice: mainGross,
        totalGross: mainGross,
        vatRate: 23,
      });
    }

    lines.push(...rowLines);

    if (shippingGross > 0) {
      lines.push({
        source: 'DEAL_FIELDS',
        name: mapping.shippingProductName,
        quantity: 1,
        unit: 'szt.',
        unitGrossPrice: shippingGross,
        totalGross: shippingGross,
        vatRate: 23,
      });
    }

    return lines;
  }

  private parseShippingCost(
    deal: BitrixDealData,
    mapping: ClientBitrixFieldMapping,
  ): number {
    const raw = deal.customFields[mapping.shippingCostField];
    const parsed = this.parseFiniteNumber(raw);

    return parsed !== undefined && parsed > 0 ? parsed : 0;
  }

  private mapProductRow(
    row: BitrixDealData['productRows'][number],
  ): ProductLine | null {
    const quantity = row.quantity;
    const grossPrice = row.grossPrice;
    const name = row.productName?.trim() ?? '';

    if (
      quantity === undefined ||
      grossPrice === undefined ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(grossPrice)
    ) {
      return {
        source: 'DEAL_PRODUCT_ROW',
        sourceId: row.id,
        name,
        quantity: quantity ?? 0,
        unit: 'szt.',
        unitGrossPrice: grossPrice ?? 0,
        totalGross: (quantity ?? 0) * (grossPrice ?? 0),
        vatRate: 23,
      };
    }

    const totalGross = quantity * grossPrice;

    return {
      source: 'DEAL_PRODUCT_ROW',
      sourceId: row.id,
      name,
      quantity,
      unit: 'szt.',
      unitGrossPrice: grossPrice,
      totalGross,
      vatRate: 23,
    };
  }

  private parseOpportunity(
    deal: BitrixDealData,
    mapping: ClientBitrixFieldMapping,
  ): number {
    const raw = deal.customFields[mapping.dealTotalField];
    const parsed = this.parseFiniteNumber(raw);

    return parsed ?? 0;
  }

  private parseAdvanceAmount(
    deal: BitrixDealData,
    mapping: ClientBitrixFieldMapping,
  ): number | undefined {
    const raw = deal.customFields[mapping.advanceAmountField];
    return this.parseFiniteNumber(raw);
  }

  private readCustomFieldValue(
    deal: BitrixDealData,
    fieldCode: string,
  ): string | undefined {
    const raw = deal.customFields[fieldCode];

    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }

    return String(raw);
  }

  private parseFiniteNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(parsed)) {
      return undefined;
    }

    return parsed;
  }
}
