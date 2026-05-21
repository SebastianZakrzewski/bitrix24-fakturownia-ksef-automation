import type {
  Bitrix24CompanyRaw,
  Bitrix24DealRaw,
  Bitrix24ProductRowRaw,
  Bitrix24RequisiteRaw,
} from '../types/bitrix24-api.types';

export const bitrixDealRawFixture = (): Bitrix24DealRaw => ({
  ID: '42',
  STAGE_ID: 'PAID',
  COMPANY_ID: '7',
  UF_INVOICE_TYPE: 'FULL',
  UF_ADVANCE_AMOUNT: '1000.00',
});

export const bitrixCompanyRawFixture = (): Bitrix24CompanyRaw => ({
  ID: '7',
  TITLE: 'Evapremium Sp. z o.o.',
});

export const bitrixRequisiteRawFixture = (): Bitrix24RequisiteRaw => ({
  ID: '1',
  ENTITY_TYPE_ID: '4',
  ENTITY_ID: '7',
  RQ_INN: '1234567890',
  RQ_ADDR: 'ul. Testowa 1',
  RQ_ZIP: '00-001',
  RQ_CITY: 'Warszawa',
  RQ_COUNTRY: 'PL',
});

export const bitrixProductRowsRawFixture = (): Bitrix24ProductRowRaw[] => [
  {
    ID: '101',
    PRODUCT_NAME: 'Panel premium',
    QUANTITY: '2',
    PRICE: '1500.50',
  },
  {
    ID: '102',
    PRODUCT_NAME: 'Montaż',
    QUANTITY: 1,
    PRICE: 500,
  },
];
