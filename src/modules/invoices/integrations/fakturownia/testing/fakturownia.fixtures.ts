import type { InvoiceDraft } from '../../../types/invoice.types';
import type {
  FakturowniaInvoiceOrderLinkage,
  FakturowniaInvoiceRaw,
  FakturowniaOrderRaw,
} from '../fakturownia.types';

const buyerFixture = () => ({
  companyName: 'Evapremium Sp. z o.o.',
  nip: '1234567890',
  street: 'ul. Testowa 1',
  postalCode: '00-001',
  city: 'Warszawa',
  country: 'PL',
});

const productsFixture = () => [
  {
    source: 'DEAL_FIELDS' as const,
    name: 'Dywaniki Evapremium',
    quantity: 1,
    unit: 'szt.' as const,
    unitGrossPrice: 6499,
    totalGross: 6499,
    vatRate: 23 as const,
  },
  {
    source: 'DEAL_PRODUCT_ROW' as const,
    sourceId: '101',
    name: 'Panel premium',
    quantity: 2,
    unit: 'szt.' as const,
    unitGrossPrice: 1500.5,
    totalGross: 3001,
    vatRate: 23 as const,
  },
];

export const invoiceDraftFullFixture = (): InvoiceDraft => ({
  bitrixDealId: '27000',
  invoiceType: 'FULL',
  buyer: buyerFixture(),
  products: productsFixture(),
  currency: 'PLN',
  vatRate: 23,
});

export const invoiceDraftAdvanceFixture = (): InvoiceDraft => ({
  ...invoiceDraftFullFixture(),
  invoiceType: 'ADVANCE',
  advanceAmount: 3000,
});

export const invoiceDraftFinalFixture = (): InvoiceDraft => ({
  ...invoiceDraftFullFixture(),
  invoiceType: 'FINAL',
  previousAdvanceInvoiceId: '2432393',
});

export const fakturowniaInvoiceOrderLinkageFixture = (
  overrides: Partial<FakturowniaInvoiceOrderLinkage> = {},
): FakturowniaInvoiceOrderLinkage => ({
  fakturowniaOrderId: '10042',
  fakturowniaOrderNumber: 'ZAM/100/2026',
  ...overrides,
});

export const fakturowniaInvoiceRawSuccessFixture = (
  overrides: Partial<FakturowniaInvoiceRaw> = {},
): FakturowniaInvoiceRaw => ({
  id: 987654,
  view_url: 'https://evapremium.fakturownia.pl/invoices/987654',
  price_net: 7747.97,
  price_gross: 9500,
  currency: 'PLN',
  gov_status: 'ok',
  ...overrides,
});

export const fakturowniaClientErrorBodyFixture = () => ({
  message: 'Invalid buyer tax number',
});

export const fakturowniaServerErrorBodyFixture = () => ({
  error: 'Internal server error',
});

export const fakturowniaOrderRawSuccessFixture = (
  overrides: Partial<FakturowniaOrderRaw> = {},
): FakturowniaOrderRaw => ({
  id: 10042,
  number: 'ZAM/100/2026',
  oid: '27000',
  ...overrides,
});
