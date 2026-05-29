import { FakturowniaMapper } from './fakturownia.mapper';
import { FakturowniaMapperError } from './fakturownia.errors';
import {
  fakturowniaInvoiceNumberAssignmentFixture,
  fakturowniaInvoiceOrderLinkageFixture,
  fakturowniaInvoiceRawSuccessFixture,
  invoiceDraftAdvanceFixture,
  invoiceDraftFinalFixture,
  invoiceDraftFullFixture,
  invoiceNumberFieldsFixture,
  invoicePaymentFieldsFixture,
} from './testing/fakturownia.fixtures';

const sharedBuyerAndPositions = {
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
};

describe('FakturowniaMapper', () => {
  const mapper = new FakturowniaMapper();
  const orderLinkage = fakturowniaInvoiceOrderLinkageFixture();
  const numberAssignment = fakturowniaInvoiceNumberAssignmentFixture();
  const numberFields = invoiceNumberFieldsFixture();
  const paymentFields = invoicePaymentFieldsFixture();

  describe('toCreatePayload', () => {
    it('maps FULL draft to vat invoice payload without order linkage', () => {
      const draft = invoiceDraftFullFixture();

      expect(mapper.toCreatePayload(draft, numberAssignment)).toEqual({
        kind: 'vat',
        currency: 'PLN',
        ...numberFields,
        ...paymentFields,
        ...sharedBuyerAndPositions,
      });
    });

    it('maps shipping product line to Fakturownia position', () => {
      const draft = invoiceDraftFullFixture();
      draft.products = [
        ...draft.products,
        {
          source: 'DEAL_FIELDS',
          name: 'Wysyłka',
          quantity: 1,
          unit: 'szt.',
          unitGrossPrice: 19.99,
          totalGross: 19.99,
          vatRate: 23,
        },
      ];

      const payload = mapper.toCreatePayload(draft, numberAssignment);
      expect(payload.kind).toBe('vat');
      if (payload.kind !== 'vat') {
        throw new Error('expected vat payload');
      }

      expect(payload.positions).toContainEqual({
        name: 'Wysyłka',
        quantity: 1,
        tax: 23,
        total_price_gross: 19.99,
      });
    });

    it('maps ADVANCE draft to minimal order-linked payload without buyer or positions', () => {
      const draft = invoiceDraftAdvanceFixture();

      expect(mapper.toCreatePayload(draft, numberAssignment, orderLinkage)).toEqual({
        kind: 'advance',
        ...numberFields,
        ...paymentFields,
        paid: '3000.00',
        copy_invoice_from: 10042,
        advance_creation_mode: 'amount',
        advance_value: '3000',
        position_name: 'Zaliczka na wykonanie zamówienia ZAM/100/2026',
      });
    });

    it('uses order id in ADVANCE position_name when order number is missing', () => {
      const draft = invoiceDraftAdvanceFixture();

      expect(
        mapper.toCreatePayload(draft, numberAssignment, {
          fakturowniaOrderId: '10042',
          fakturowniaOrderNumber: null,
        }),
      ).toEqual(
        expect.objectContaining({
          position_name: 'Zaliczka na wykonanie zamówienia 10042',
        }),
      );
    });

    it('maps FINAL draft to minimal order-linked payload without buyer or positions', () => {
      const draft = invoiceDraftFinalFixture();

      expect(mapper.toCreatePayload(draft, numberAssignment, orderLinkage)).toEqual({
        kind: 'final',
        ...numberFields,
        ...paymentFields,
        copy_invoice_from: 10042,
        invoice_ids: [2432393],
      });
    });

    it('sets paid_date to issue_date from number assignment for all invoice types', () => {
      const assignment = fakturowniaInvoiceNumberAssignmentFixture({
        issueDate: '2026-06-15',
        sellDate: '2026-06-15',
      });

      const fullPayload = mapper.toCreatePayload(
        invoiceDraftFullFixture(),
        assignment,
      );
      expect(fullPayload).toMatchObject({
        paid_date: '2026-06-15',
        status: 'paid',
        issue_date: '2026-06-15',
      });

      const advancePayload = mapper.toCreatePayload(
        invoiceDraftAdvanceFixture(),
        assignment,
        orderLinkage,
      );
      expect(advancePayload).toMatchObject({
        paid_date: '2026-06-15',
        status: 'paid',
      });
    });

    it('throws when ADVANCE draft is mapped without order linkage', () => {
      expect(() => mapper.toCreatePayload(invoiceDraftAdvanceFixture(), numberAssignment)).toThrow(
        new FakturowniaMapperError(
          'Fakturownia order linkage is required for ADVANCE invoice payload',
        ),
      );
    });

    it('throws when FINAL draft is mapped without order linkage', () => {
      expect(() => mapper.toCreatePayload(invoiceDraftFinalFixture(), numberAssignment)).toThrow(
        new FakturowniaMapperError(
          'Fakturownia order linkage is required for FINAL invoice payload',
        ),
      );
    });

    it('throws when order linkage fakturowniaOrderId is empty', () => {
      expect(() =>
        mapper.toCreatePayload(invoiceDraftAdvanceFixture(), numberAssignment, {
          fakturowniaOrderId: '   ',
        }),
      ).toThrow(
        new FakturowniaMapperError(
          'Fakturownia order linkage is missing fakturowniaOrderId',
        ),
      );
    });

    it('normalizes Bitrix country name Poland to ISO PL in buyer_country', () => {
      const base = invoiceDraftFullFixture();
      const draft = {
        ...base,
        buyer: { ...base.buyer, country: 'Poland' },
      };

      const payload = mapper.toCreatePayload(draft, numberAssignment);
      expect(payload.kind).toBe('vat');
      if (payload.kind !== 'vat') {
        throw new Error('expected vat payload');
      }

      expect(payload.buyer_country).toBe('PL');
    });

    it('throws when order linkage fakturowniaOrderId is not numeric', () => {
      expect(() =>
        mapper.toCreatePayload(invoiceDraftFinalFixture(), numberAssignment, {
          fakturowniaOrderId: 'not-a-number',
        }),
      ).toThrow(
        new FakturowniaMapperError(
          'Fakturownia order linkage fakturowniaOrderId is not a valid number',
        ),
      );
    });
  });

  describe('toCreateResult', () => {
    it('maps successful raw response to integration result', () => {
      const result = mapper.toCreateResult(fakturowniaInvoiceRawSuccessFixture());

      expect(result).toEqual({
        fakturowniaInvoiceId: '987654',
        fakturowniaInvoiceUrl:
          'https://evapremium.fakturownia.pl/invoices/987654',
        totalNet: 7747.97,
        totalGross: 9500,
        currency: 'PLN',
        ksefStatus: 'SUBMISSION_CONFIRMED',
        ksefRawStatus: 'ok',
      });
    });

    it('parses comma-separated decimal amounts', () => {
      const result = mapper.toCreateResult(
        fakturowniaInvoiceRawSuccessFixture({
          price_net: '59,00',
          price_gross: '72,57',
        }),
      );

      expect(result.totalNet).toBe(59);
      expect(result.totalGross).toBe(72.57);
    });

    it('maps KSeF send_error to SUBMISSION_ERROR', () => {
      const result = mapper.toCreateResult(
        fakturowniaInvoiceRawSuccessFixture({ gov_status: 'send_error' }),
      );

      expect(result.ksefStatus).toBe('SUBMISSION_ERROR');
      expect(result.ksefRawStatus).toBe('send_error');
    });

    it('maps KSeF processing to STATUS_UNKNOWN', () => {
      const result = mapper.toCreateResult(
        fakturowniaInvoiceRawSuccessFixture({ gov_status: 'processing' }),
      );

      expect(result.ksefStatus).toBe('STATUS_UNKNOWN');
      expect(result.ksefRawStatus).toBe('processing');
    });

    it('throws when view_url is missing', () => {
      expect(() =>
        mapper.toCreateResult(
          fakturowniaInvoiceRawSuccessFixture({ view_url: undefined }),
        ),
      ).toThrow(FakturowniaMapperError);
    });
  });
});
