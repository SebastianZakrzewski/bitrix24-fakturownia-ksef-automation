import { Injectable } from '@nestjs/common';
import type { InvoiceDraft } from '../../types/invoice.types';
import { normalizeFakturowniaBuyerCountry } from './fakturownia-buyer-country.util';
import { FakturowniaMapperError } from './fakturownia.errors';
import type {
  FakturowniaCreateOrderResult,
  FakturowniaOrderPayload,
  FakturowniaOrderPositionPayload,
  FakturowniaOrderRaw,
} from './fakturownia.types';

@Injectable()
export class FakturowniaOrderMapper {
  toCreatePayload(draft: InvoiceDraft): FakturowniaOrderPayload {
    return {
      kind: 'estimate',
      currency: 'PLN',
      oid: draft.bitrixDealId,
      ...this.mapBuyer(draft),
      positions: this.mapPositions(draft),
    };
  }

  toCreateResult(raw: FakturowniaOrderRaw): FakturowniaCreateOrderResult {
    if (raw.id === undefined || raw.id === null || raw.id === '') {
      throw new FakturowniaMapperError(
        'Fakturownia order response is missing id',
      );
    }

    const result: FakturowniaCreateOrderResult = {
      fakturowniaOrderId: String(raw.id),
    };

    if (raw.number?.trim()) {
      result.fakturowniaOrderNumber = raw.number;
    }

    return result;
  }

  private mapBuyer(
    draft: InvoiceDraft,
  ): Pick<
    FakturowniaOrderPayload,
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

  private mapPositions(draft: InvoiceDraft): FakturowniaOrderPositionPayload[] {
    return draft.products.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      tax: line.vatRate,
      total_price_gross: line.totalGross,
    }));
  }
}
