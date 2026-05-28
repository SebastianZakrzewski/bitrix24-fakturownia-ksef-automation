import type { BitrixCompanyData, BitrixDealData, BitrixProductRow } from '../../bitrix24/types/bitrix24.types';
import { EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS } from '../config/evapremium-v1-client-config';
import type { ClientConfigMappings } from '../types/client-config.types';

const M = EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping;

export const evapremiumClientConfigFixture = (): ClientConfigMappings =>
  EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS;

const defaultDealBase = (): Omit<BitrixDealData, 'customFields' | 'productRows'> => ({
  dealId: '27000',
  dealUrl: 'https://evapremium.bitrix24.pl/crm/deal/details/27000/',
  stageId: 'PREPARATION',
  companyId: '7',
});

const invoiceDocumentFields = (overrides: {
  documentType?: string;
  paymentForm?: string;
  invoiceDocumentType?: string;
  advanceAmount?: string | number;
  opportunity?: string | number;
  shippingCost?: string | number;
}): Record<string, unknown> => {
  const fields: Record<string, unknown> = {
    [M.documentTypeField]: overrides.documentType ?? M.documentTypeInvoiceValueId,
    OPPORTUNITY: overrides.opportunity ?? '10000',
  };

  if (overrides.paymentForm !== undefined) {
    fields[M.paymentFormField] = overrides.paymentForm;
  }

  if (overrides.invoiceDocumentType !== undefined) {
    fields[M.invoiceDocumentTypeField] = overrides.invoiceDocumentType;
  }

  if (overrides.advanceAmount !== undefined) {
    fields[M.advanceAmountField] = overrides.advanceAmount;
  }

  if (overrides.shippingCost !== undefined) {
    fields[M.shippingCostField] = overrides.shippingCost;
  }

  return fields;
};

export const bitrixProductRowsFixture = (): BitrixProductRow[] => [
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
];

export const bitrixCompanyValidFixture = (): BitrixCompanyData => ({
  companyId: '7',
  name: 'Evapremium Sp. z o.o.',
  nip: '1234567890',
  street: 'ul. Testowa 1',
  postalCode: '00-001',
  city: 'Warszawa',
  country: 'PL',
  customerEmail: 'billing@evapremium.test',
});

export const bitrixCompanyMissingEmail = (): BitrixCompanyData => ({
  ...bitrixCompanyValidFixture(),
  customerEmail: undefined,
});

export const bitrixCompanyInvalidEmail = (): BitrixCompanyData => ({
  ...bitrixCompanyValidFixture(),
  customerEmail: 'not-an-email',
});

export const bitrixDealForFull = (
  overrides?: Partial<Pick<BitrixDealData, 'productRows' | 'companyId'>>,
): BitrixDealData => ({
  ...defaultDealBase(),
  companyId: overrides?.companyId ?? '7',
  customFields: invoiceDocumentFields({
    paymentForm: M.paymentFormFullValueId,
  }),
  productRows: overrides?.productRows ?? bitrixProductRowsFixture(),
});

export const bitrixDealForAdvance = (
  overrides?: Partial<Pick<BitrixDealData, 'productRows' | 'companyId'>>,
): BitrixDealData => ({
  ...defaultDealBase(),
  companyId: overrides?.companyId ?? '7',
  customFields: invoiceDocumentFields({
    paymentForm: M.paymentFormAdvanceValueId,
    advanceAmount: '3000',
  }),
  productRows: overrides?.productRows ?? bitrixProductRowsFixture(),
});

export const bitrixDealForFinal = (
  overrides?: Partial<Pick<BitrixDealData, 'productRows' | 'companyId'>>,
): BitrixDealData => ({
  ...defaultDealBase(),
  companyId: overrides?.companyId ?? '7',
  customFields: invoiceDocumentFields({
    paymentForm: M.paymentFormFullValueId,
    invoiceDocumentType: M.invoiceDocumentTypeFinalValueId,
  }),
  productRows: overrides?.productRows ?? bitrixProductRowsFixture(),
});

export const bitrixDealWithOpportunity = (
  opportunity: number,
  productRows: BitrixProductRow[] = [],
): BitrixDealData => ({
  ...defaultDealBase(),
  customFields: invoiceDocumentFields({
    paymentForm: M.paymentFormFullValueId,
    opportunity: String(opportunity),
  }),
  productRows,
});

/** Incomplete FINAL: Dopełniająca (1328) + Zaliczka (720) — type not resolvable. */
export const bitrixDealMissingInvoiceType = (): BitrixDealData => ({
  ...defaultDealBase(),
  customFields: {
    [M.documentTypeField]: M.documentTypeInvoiceValueId,
    [M.paymentFormField]: M.paymentFormAdvanceValueId,
    [M.invoiceDocumentTypeField]: M.invoiceDocumentTypeFinalValueId,
    OPPORTUNITY: '10000',
  },
  productRows: bitrixProductRowsFixture(),
});

export const bitrixDealNoCompany = (): BitrixDealData => ({
  ...bitrixDealForFull(),
  companyId: undefined,
});

export const bitrixDealEmptyProducts = (): BitrixDealData => ({
  ...bitrixDealForFull(),
  productRows: [],
  customFields: invoiceDocumentFields({
    paymentForm: M.paymentFormFullValueId,
    opportunity: '0',
  }),
});

export const bitrixDealAdvanceNoAmount = (): BitrixDealData => {
  const deal = bitrixDealForAdvance();
  const { [M.advanceAmountField]: _removed, ...rest } = deal.customFields as Record<
    string,
    unknown
  >;
  return {
    ...deal,
    customFields: rest,
  };
};

/** ADVANCE deal with explicit advance amount field (e.g. zero or negative for validation tests). */
export const bitrixDealAdvanceWithAmount = (
  advanceAmount: string | number,
): BitrixDealData => ({
  ...bitrixDealForAdvance(),
  customFields: invoiceDocumentFields({
    paymentForm: M.paymentFormAdvanceValueId,
    advanceAmount,
  }),
});

export const bitrixCompanyNoNip = (): BitrixCompanyData => ({
  ...bitrixCompanyValidFixture(),
  nip: undefined,
});

export const bitrixProductRowInvalidFixture = (): BitrixProductRow[] => [
  {
    id: '201',
    productName: '',
    quantity: 1,
    grossPrice: 100,
  },
];
