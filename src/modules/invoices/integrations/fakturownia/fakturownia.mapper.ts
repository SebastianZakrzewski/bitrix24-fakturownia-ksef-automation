import { Injectable } from '@nestjs/common';
import type { InvoiceDraft } from '../../types/invoice.types';
import { normalizeFakturowniaBuyerCountry } from './fakturownia-buyer-country.util';
import { FakturowniaMapperError } from './fakturownia.errors';
import type {
  FakturowniaCreateInvoiceResult,
  FakturowniaInvoiceNumberAssignment,
  FakturowniaInvoiceOrderLinkage,
  FakturowniaInvoicePayload,
  FakturowniaInvoiceRaw,
  FakturowniaPositionPayload,
  FakturowniaVatInvoicePayload,
} from './fakturownia.types';

const KSEF_SUBMISSION_CONFIRMED = new Set(['ok', 'demo_ok']);
const KSEF_SUBMISSION_ERROR = new Set([
  'send_error',
  'server_error',
  'demo_send_error',
  'demo_server_error',
  'not_connected',
  'demo_not_connected',
]);

@Injectable()
export class FakturowniaMapper {
  toCreatePayload(
    draft: InvoiceDraft,
    numberAssignment: FakturowniaInvoiceNumberAssignment,
    orderLinkage?: FakturowniaInvoiceOrderLinkage,
  ): FakturowniaInvoicePayload {
    const numberFields = this.mapNumberFields(numberAssignment);

    switch (draft.invoiceType) {
      case 'FULL':
        return {
          kind: 'vat',
          currency: 'PLN',
          ...numberFields,
          ...this.mapBuyer(draft),
          positions: this.mapPositions(draft),
        };
      case 'ADVANCE': {
        const linkage = this.requireOrderLinkage('ADVANCE', orderLinkage);

        return {
          kind: 'advance',
          ...numberFields,
          copy_invoice_from: this.mapCopyInvoiceFrom(linkage),
          advance_creation_mode: 'amount',
          advance_value: String(draft.advanceAmount),
          position_name: this.mapAdvancePositionName(linkage),
        };
      }
      case 'FINAL': {
        const linkage = this.requireOrderLinkage('FINAL', orderLinkage);

        return {
          kind: 'final',
          ...numberFields,
          copy_invoice_from: this.mapCopyInvoiceFrom(linkage),
          invoice_ids: [Number(draft.previousAdvanceInvoiceId)],
        };
      }
    }
  }

  toCreateResult(raw: FakturowniaInvoiceRaw): FakturowniaCreateInvoiceResult {
    if (!raw.view_url) {
      throw new FakturowniaMapperError(
        'Fakturownia response is missing view_url',
      );
    }

    const ksefStatus = this.mapKsefStatus(raw.gov_status);

    return {
      fakturowniaInvoiceId: String(raw.id),
      fakturowniaInvoiceUrl: raw.view_url,
      totalNet: this.parseAmount(raw.price_net),
      totalGross: this.parseAmount(raw.price_gross),
      currency: 'PLN',
      ...(ksefStatus !== undefined
        ? {
            ksefStatus: ksefStatus.status,
            ksefRawStatus: ksefStatus.rawStatus,
          }
        : {}),
    };
  }

  private mapNumberFields(
    numberAssignment: FakturowniaInvoiceNumberAssignment,
  ): Pick<FakturowniaVatInvoicePayload, 'number' | 'issue_date' | 'sell_date'> {
    return {
      number: numberAssignment.number,
      issue_date: numberAssignment.issueDate,
      sell_date: numberAssignment.sellDate,
    };
  }

  private requireOrderLinkage(
    invoiceType: 'ADVANCE' | 'FINAL',
    orderLinkage?: FakturowniaInvoiceOrderLinkage,
  ): FakturowniaInvoiceOrderLinkage {
    if (!orderLinkage) {
      throw new FakturowniaMapperError(
        `Fakturownia order linkage is required for ${invoiceType} invoice payload`,
      );
    }

    return orderLinkage;
  }

  private mapAdvancePositionName(
    orderLinkage: FakturowniaInvoiceOrderLinkage,
  ): string {
    const orderReference =
      orderLinkage.fakturowniaOrderNumber?.trim() ||
      orderLinkage.fakturowniaOrderId.trim();

    return `Zaliczka na wykonanie zamówienia ${orderReference}`;
  }

  private mapCopyInvoiceFrom(
    orderLinkage: FakturowniaInvoiceOrderLinkage,
  ): number {
    const trimmed = orderLinkage.fakturowniaOrderId.trim();

    if (!trimmed) {
      throw new FakturowniaMapperError(
        'Fakturownia order linkage is missing fakturowniaOrderId',
      );
    }

    const id = Number(trimmed);

    if (Number.isNaN(id)) {
      throw new FakturowniaMapperError(
        'Fakturownia order linkage fakturowniaOrderId is not a valid number',
      );
    }

    return id;
  }

  private mapBuyer(
    draft: InvoiceDraft,
  ): Pick<
    FakturowniaVatInvoicePayload,
    | 'buyer_name'
    | 'buyer_tax_no'
    | 'buyer_street'
    | 'buyer_post_code'
    | 'buyer_city'
    | 'buyer_country'
  > {
    return {
      buyer_name: draft.buyer.companyName,
      buyer_tax_no: draft.buyer.nip,
      buyer_street: draft.buyer.street,
      buyer_post_code: draft.buyer.postalCode,
      buyer_city: draft.buyer.city,
      buyer_country: normalizeFakturowniaBuyerCountry(draft.buyer.country),
    };
  }

  private mapPositions(draft: InvoiceDraft): FakturowniaPositionPayload[] {
    return draft.products.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      tax: line.vatRate,
      total_price_gross: line.totalGross,
    }));
  }

  private parseAmount(value: number | string | undefined): number {
    if (value === undefined) {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    const normalized = value.replace(',', '.');
    const parsed = Number.parseFloat(normalized);

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private mapKsefStatus(
    govStatus: string | null | undefined,
  ):
    | {
        status: NonNullable<FakturowniaCreateInvoiceResult['ksefStatus']>;
        rawStatus: string;
      }
    | undefined {
    if (govStatus === undefined) {
      return undefined;
    }

    const rawStatus = govStatus ?? 'null';

    if (KSEF_SUBMISSION_CONFIRMED.has(rawStatus)) {
      return { status: 'SUBMISSION_CONFIRMED', rawStatus };
    }

    if (KSEF_SUBMISSION_ERROR.has(rawStatus)) {
      return { status: 'SUBMISSION_ERROR', rawStatus };
    }

    return { status: 'STATUS_UNKNOWN', rawStatus };
  }
}
