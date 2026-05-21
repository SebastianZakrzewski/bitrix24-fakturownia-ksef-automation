import { EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS } from '../config/evapremium-v1-client-config';
import {
  bitrixCompanyValidFixture,
  bitrixDealForAdvance,
  bitrixDealForFinal,
  bitrixDealForFull,
  bitrixDealWithOpportunity,
  bitrixProductRowsFixture,
  evapremiumClientConfigFixture,
} from '../testing/invoice-mapping.fixtures';
import { BitrixInvoiceMapper } from './bitrix-invoice.mapper';

describe('BitrixInvoiceMapper', () => {
  const mapper = new BitrixInvoiceMapper();
  const config = evapremiumClientConfigFixture();
  const M = EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping;

  it('resolves FULL invoice type from payment form', () => {
    const result = mapper.map(
      bitrixDealForFull(),
      bitrixCompanyValidFixture(),
      config,
    );

    expect(result.invoiceType).toBe('FULL');
  });

  it('resolves ADVANCE invoice type and advance amount', () => {
    const result = mapper.map(
      bitrixDealForAdvance(),
      bitrixCompanyValidFixture(),
      config,
    );

    expect(result.invoiceType).toBe('ADVANCE');
    expect(result.advanceAmount).toBe(3000);
  });

  it('resolves FINAL invoice type when dopełniająca and pełna płatność', () => {
    const result = mapper.map(
      bitrixDealForFinal(),
      bitrixCompanyValidFixture(),
      config,
    );

    expect(result.invoiceType).toBe('FINAL');
  });

  it('does not resolve FINAL when dopełniająca with zaliczka payment form', () => {
    const deal = bitrixDealForFinal();
    deal.customFields[M.paymentFormField] = M.paymentFormAdvanceValueId;

    const result = mapper.map(deal, bitrixCompanyValidFixture(), config);

    expect(result.invoiceType).toBeUndefined();
  });

  it('maps buyer from company data', () => {
    const result = mapper.map(
      bitrixDealForFull(),
      bitrixCompanyValidFixture(),
      config,
    );

    expect(result.buyer).toEqual({
      companyId: '7',
      companyName: 'Evapremium Sp. z o.o.',
      nip: '1234567890',
      street: 'ul. Testowa 1',
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    });
  });

  it('maps main product line as OPPORTUNITY minus product rows', () => {
    const result = mapper.map(
      bitrixDealForFull(),
      bitrixCompanyValidFixture(),
      config,
    );

    const mainLine = result.products[0];
    const rowTotal = 2 * 1500.5 + 500;

    expect(mainLine).toMatchObject({
      source: 'DEAL_FIELDS',
      name: M.mainProductName,
      quantity: 1,
      unitGrossPrice: 10000 - rowTotal,
      totalGross: 10000 - rowTotal,
      vatRate: 23,
    });
    expect(result.products).toHaveLength(3);
    expect(result.products[1]?.source).toBe('DEAL_PRODUCT_ROW');
  });

  it('uses full OPPORTUNITY as main line when no product rows', () => {
    const result = mapper.map(
      bitrixDealWithOpportunity(5000, []),
      bitrixCompanyValidFixture(),
      config,
    );

    expect(result.products).toEqual([
      {
        source: 'DEAL_FIELDS',
        name: M.mainProductName,
        quantity: 1,
        unit: 'szt.',
        unitGrossPrice: 5000,
        totalGross: 5000,
        vatRate: 23,
      },
    ]);
  });

  it('omits main line when OPPORTUNITY minus rows is not positive', () => {
    const rows = bitrixProductRowsFixture();
    const result = mapper.map(
      bitrixDealWithOpportunity(1000, rows),
      bitrixCompanyValidFixture(),
      config,
    );

    expect(result.products.every((p) => p.source === 'DEAL_PRODUCT_ROW')).toBe(true);
    expect(result.products).toHaveLength(2);
  });
});
