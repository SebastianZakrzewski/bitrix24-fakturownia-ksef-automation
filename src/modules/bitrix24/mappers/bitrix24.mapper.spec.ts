import {
  bitrixCompanyRawFixture,
  bitrixDealRawFixture,
  bitrixProductRowsRawFixture,
  bitrixRequisiteRawFixture,
} from '../testing/bitrix24.fixtures';
import { Bitrix24Mapper } from './bitrix24.mapper';

describe('Bitrix24Mapper', () => {
  const mapper = new Bitrix24Mapper();

  it('maps deal raw to BitrixDealCore with customFields', () => {
    const core = mapper.mapDeal(bitrixDealRawFixture(), {
      portalBaseUrl: 'https://portal.bitrix24.pl',
    });

    expect(core).toEqual({
      dealId: '42',
      dealUrl: 'https://portal.bitrix24.pl/crm/deal/details/42/',
      stageId: 'PAID',
      companyId: '7',
      customFields: {
        UF_INVOICE_TYPE: 'FULL',
        UF_ADVANCE_AMOUNT: '1000.00',
      },
    });
  });

  it('leaves dealUrl undefined without portal base URL', () => {
    const core = mapper.mapDeal(bitrixDealRawFixture());

    expect(core.dealUrl).toBeUndefined();
  });

  it('maps company and requisite to BitrixCompanyData', () => {
    const company = mapper.mapCompany(
      bitrixCompanyRawFixture(),
      bitrixRequisiteRawFixture(),
    );

    expect(company).toEqual({
      companyId: '7',
      name: 'Evapremium Sp. z o.o.',
      nip: '1234567890',
      street: 'ul. Testowa 1',
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    });
  });

  it('maps company without requisite using company address fields', () => {
    const company = mapper.mapCompany({
      ID: '7',
      TITLE: 'Firma',
      ADDRESS: 'ul. Backup 2',
      ADDRESS_POSTAL_CODE: '02-002',
      ADDRESS_CITY: 'Kraków',
      ADDRESS_COUNTRY: 'PL',
    });

    expect(company).toMatchObject({
      companyId: '7',
      name: 'Firma',
      street: 'ul. Backup 2',
      postalCode: '02-002',
      city: 'Kraków',
      country: 'PL',
    });
    expect(company.nip).toBeUndefined();
  });

  it('maps product rows with numeric string coercion', () => {
    const rows = bitrixProductRowsRawFixture().map((raw) =>
      mapper.mapProductRow(raw),
    );

    expect(rows).toEqual([
      {
        id: '101',
        productName: 'Panel premium',
        quantity: 2,
        grossPrice: 1500.5,
      },
      {
        id: '102',
        productName: 'Montaż',
        quantity: 1,
        grossPrice: 500,
      },
    ]);
  });

  it('combines deal core and product rows into BitrixDealData', () => {
    const core = mapper.mapDeal(bitrixDealRawFixture());
    const productRows = bitrixProductRowsRawFixture().map((raw) =>
      mapper.mapProductRow(raw),
    );

    expect(mapper.toBitrixDealData(core, productRows)).toEqual({
      ...core,
      productRows,
    });
  });
});
