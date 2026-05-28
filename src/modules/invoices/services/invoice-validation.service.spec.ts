import { BitrixInvoiceMapper } from '../mappers/bitrix-invoice.mapper';
import {
  bitrixCompanyInvalidEmail,
  bitrixCompanyMissingEmail,
  bitrixCompanyNoNip,
  bitrixCompanyValidFixture,
  bitrixDealAdvanceNoAmount,
  bitrixDealAdvanceWithAmount,
  bitrixDealEmptyProducts,
  bitrixDealForAdvance,
  bitrixDealForFinal,
  bitrixDealForFull,
  bitrixDealMissingInvoiceType,
  bitrixDealNoCompany,
  bitrixProductRowInvalidFixture,
  evapremiumClientConfigFixture,
} from '../testing/invoice-mapping.fixtures';
import { InvoiceDraftBuilderService } from './invoice-draft-builder.service';
import { InvoiceValidationService } from './invoice-validation.service';

describe('InvoiceValidationService', () => {
  const mapper = new BitrixInvoiceMapper();
  const validation = new InvoiceValidationService();
  const builder = new InvoiceDraftBuilderService();
  const config = evapremiumClientConfigFixture();

  const mapAndValidate = (
    deal: ReturnType<typeof bitrixDealForFull>,
    company: ReturnType<typeof bitrixCompanyValidFixture> | undefined,
    context: { previousAdvanceInvoiceId?: string } = {},
  ) => {
    const mapping = mapper.map(deal, company, config);
    return validation.validate(mapping, config, context);
  };

  describe('happy paths', () => {
    it('validates FULL mapping', () => {
      const result = mapAndValidate(bitrixDealForFull(), bitrixCompanyValidFixture());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.invoiceType).toBe('FULL');
        expect(result.data.advanceAmount).toBeUndefined();
        expect(result.data.buyer.customerEmail).toBe('billing@evapremium.test');
      }
    });

    it('validates ADVANCE mapping with advance amount', () => {
      const result = mapAndValidate(bitrixDealForAdvance(), bitrixCompanyValidFixture());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.invoiceType).toBe('ADVANCE');
        expect(result.data.advanceAmount).toBe(3000);
      }
    });

    it('validates FINAL mapping with previous advance invoice id', () => {
      const result = mapAndValidate(bitrixDealForFinal(), bitrixCompanyValidFixture(), {
        previousAdvanceInvoiceId: 'rec-advance-1',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.invoiceType).toBe('FINAL');
        expect(result.data.previousAdvanceInvoiceId).toBe('rec-advance-1');
      }
    });
  });

  describe('failure paths', () => {
    it('returns MISSING_INVOICE_TYPE when type cannot be resolved', () => {
      const result = mapAndValidate(
        bitrixDealMissingInvoiceType(),
        bitrixCompanyValidFixture(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'MISSING_INVOICE_TYPE')).toBe(true);
      }
    });

    it('returns MISSING_COMPANY when deal has no company', () => {
      const result = mapAndValidate(bitrixDealNoCompany(), undefined);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_COMPANY', source: 'BITRIX_DEAL' }),
        );
      }
    });

    it('returns MISSING_NIP when company has no NIP', () => {
      const result = mapAndValidate(bitrixDealForFull(), bitrixCompanyNoNip());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_NIP', source: 'BITRIX_COMPANY' }),
        );
      }
    });

    it('returns MISSING_PRODUCTS when no product lines', () => {
      const result = mapAndValidate(
        bitrixDealEmptyProducts(),
        bitrixCompanyValidFixture(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'MISSING_PRODUCTS', source: 'PRODUCT_MAPPING' }),
        );
      }
    });

    it('returns INVALID_PRODUCT_LINE for invalid product row', () => {
      const deal = bitrixDealForFull();
      deal.productRows = bitrixProductRowInvalidFixture();

      const result = mapAndValidate(deal, bitrixCompanyValidFixture());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'INVALID_PRODUCT_LINE')).toBe(true);
      }
    });

    it('returns MISSING_ADVANCE_AMOUNT for ADVANCE without amount', () => {
      const result = mapAndValidate(
        bitrixDealAdvanceNoAmount(),
        bitrixCompanyValidFixture(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'MISSING_ADVANCE_AMOUNT',
            source: 'BITRIX_DEAL',
          }),
        );
      }
    });

    it.each([
      { label: 'zero', advanceAmount: '0' },
      { label: 'negative', advanceAmount: '-100' },
    ])(
      'returns INVALID_ADVANCE_AMOUNT for ADVANCE with $label advance amount',
      ({ advanceAmount }) => {
        const result = mapAndValidate(
          bitrixDealAdvanceWithAmount(advanceAmount),
          bitrixCompanyValidFixture(),
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors).toContainEqual(
            expect.objectContaining({
              code: 'INVALID_ADVANCE_AMOUNT',
              field: 'advanceAmount',
              source: 'BITRIX_DEAL',
            }),
          );
          expect(result.errors.some((e) => e.code === 'MISSING_ADVANCE_AMOUNT')).toBe(
            false,
          );
        }
      },
    );

    it('returns MISSING_PREVIOUS_ADVANCE_INVOICE for FINAL without prior advance', () => {
      const result = mapAndValidate(bitrixDealForFinal(), bitrixCompanyValidFixture());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'MISSING_PREVIOUS_ADVANCE_INVOICE',
            source: 'INVOICE_RULE',
          }),
        );
      }
    });

    it('returns MISSING_CUSTOMER_EMAIL when company has no email', () => {
      const result = mapAndValidate(
        bitrixDealForFull(),
        bitrixCompanyMissingEmail(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'MISSING_CUSTOMER_EMAIL',
            field: 'customerEmail',
            source: 'BITRIX_COMPANY',
          }),
        );
      }
    });

    it('returns INVALID_CUSTOMER_EMAIL when email format is invalid', () => {
      const result = mapAndValidate(
        bitrixDealForFull(),
        bitrixCompanyInvalidEmail(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_CUSTOMER_EMAIL',
            field: 'customerEmail',
            source: 'BITRIX_COMPANY',
          }),
        );
      }
    });

    it('normalizes customerEmail to lowercase on success', () => {
      const company = bitrixCompanyValidFixture();
      company.customerEmail = '  Billing@Evapremium.TEST  ';

      const result = mapAndValidate(bitrixDealForFull(), company);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.buyer.customerEmail).toBe('billing@evapremium.test');
      }
    });
  });

  describe('map → validate → build', () => {
    it('builds InvoiceDraft for FULL happy path', () => {
      const mapping = mapper.map(
        bitrixDealForFull(),
        bitrixCompanyValidFixture(),
        config,
      );
      const validated = validation.validate(mapping, config);
      expect(validated.ok).toBe(true);
      if (!validated.ok) {
        return;
      }

      const draft = builder.build(validated.data);

      expect(draft).toMatchObject({
        bitrixDealId: '27000',
        invoiceType: 'FULL',
        currency: 'PLN',
        vatRate: 23,
        buyer: {
          companyName: 'Evapremium Sp. z o.o.',
          nip: '1234567890',
        },
      });
      expect(draft.products.length).toBeGreaterThan(0);
      expect(draft.advanceAmount).toBeUndefined();
      expect(draft.previousAdvanceInvoiceId).toBeUndefined();
    });

    it('builds InvoiceDraft for ADVANCE happy path', () => {
      const mapping = mapper.map(
        bitrixDealForAdvance(),
        bitrixCompanyValidFixture(),
        config,
      );
      const validated = validation.validate(mapping, config);
      expect(validated.ok).toBe(true);
      if (!validated.ok) {
        return;
      }

      const draft = builder.build(validated.data);

      expect(draft.invoiceType).toBe('ADVANCE');
      expect(draft.advanceAmount).toBe(3000);
    });

    it('builds InvoiceDraft for FINAL happy path', () => {
      const mapping = mapper.map(
        bitrixDealForFinal(),
        bitrixCompanyValidFixture(),
        config,
      );
      const validated = validation.validate(mapping, config, {
        previousAdvanceInvoiceId: 'rec-advance-1',
      });
      expect(validated.ok).toBe(true);
      if (!validated.ok) {
        return;
      }

      const draft = builder.build(validated.data);

      expect(draft.invoiceType).toBe('FINAL');
      expect(draft.previousAdvanceInvoiceId).toBe('rec-advance-1');
      expect(draft.advanceAmount).toBeUndefined();
    });
  });
});
