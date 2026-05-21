import { FakturowniaOrderMapper } from './fakturownia-order.mapper';
import { FakturowniaMapperError } from './fakturownia.errors';
import {
  fakturowniaOrderRawSuccessFixture,
  invoiceDraftAdvanceFixture,
} from './testing/fakturownia.fixtures';

describe('FakturowniaOrderMapper', () => {
  const mapper = new FakturowniaOrderMapper();

  describe('toCreatePayload', () => {
    it('maps InvoiceDraft to estimate order payload', () => {
      const draft = invoiceDraftAdvanceFixture();

      expect(mapper.toCreatePayload(draft)).toEqual({
        kind: 'estimate',
        currency: 'PLN',
        oid: '27000',
        buyer_name: 'Evapremium Sp. z o.o.',
        buyer_tax_no: '1234567890',
        buyer_street: 'ul. Testowa 1',
        buyer_post_code: '00-001',
        buyer_city: 'Warszawa',
        buyer_country: 'PL',
        positions: [
          {
            name: 'Dywaniki Evapremium',
            quantity: 1,
            tax: 23,
            total_price_gross: 6499,
          },
          {
            name: 'Panel premium',
            quantity: 2,
            tax: 23,
            total_price_gross: 3001,
          },
        ],
      });
    });

    it('does not include invoice-type-specific fields', () => {
      const payload = mapper.toCreatePayload(invoiceDraftAdvanceFixture());

      expect(payload).not.toHaveProperty('advance_creation_mode');
      expect(payload).not.toHaveProperty('advance_value');
      expect(payload).not.toHaveProperty('invoice_ids');
    });
  });

  describe('toCreateResult', () => {
    it('maps successful raw response to integration result', () => {
      expect(mapper.toCreateResult(fakturowniaOrderRawSuccessFixture())).toEqual({
        fakturowniaOrderId: '10042',
        fakturowniaOrderNumber: 'ZAM/100/2026',
      });
    });

    it('omits order number when raw number is empty', () => {
      expect(
        mapper.toCreateResult(
          fakturowniaOrderRawSuccessFixture({ number: '   ' }),
        ),
      ).toEqual({
        fakturowniaOrderId: '10042',
      });
    });

    it('throws when id is missing', () => {
      expect(() =>
        mapper.toCreateResult(fakturowniaOrderRawSuccessFixture({ id: undefined })),
      ).toThrow(FakturowniaMapperError);
    });
  });
});
