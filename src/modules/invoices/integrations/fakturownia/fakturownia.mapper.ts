import { Injectable } from '@nestjs/common';
import type { InvoiceDraft } from '../../types/invoice.types';
import { FakturowniaMapperError } from './fakturownia.errors';
import type {
  FakturowniaCreateInvoiceResult,
  FakturowniaInvoicePayload,
  FakturowniaInvoiceRaw,
  FakturowniaPositionPayload,
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
  toCreatePayload(draft: InvoiceDraft): FakturowniaInvoicePayload {
    const positions = this.mapPositions(draft);
    const buyer = this.mapBuyer(draft);

    switch (draft.invoiceType) {
      case 'FULL':
        return {
          kind: 'vat',
          currency: 'PLN',
          ...buyer,
          positions,
        };
      case 'ADVANCE':
        return {
          kind: 'advance',
          currency: 'PLN',
          ...buyer,
          positions,
          advance_creation_mode: 'amount',
          advance_value: String(draft.advanceAmount),
        };
      case 'FINAL':
        return {
          kind: 'final',
          currency: 'PLN',
          ...buyer,
          positions,
          invoice_ids: [Number(draft.previousAdvanceInvoiceId)],
        };
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

  private mapBuyer(
    draft: InvoiceDraft,
  ): Pick<
    FakturowniaInvoicePayload,
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
      buyer_country: draft.buyer.country,
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
