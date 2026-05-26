import { DEFAULT_TEST_DEAL_PREFIX } from '../safety-guards';
import {
  EVAPREMIUM_BITRIX_FIELD_MAPPING,
  EVAPREMIUM_BITRIX_PAID_STAGE_ID,
} from './evapremium-bitrix-field-mapping';
import type { BitrixTestCompanyInput, BitrixTestDealInput } from './bitrix-test-setup-client.types';

const M = EVAPREMIUM_BITRIX_FIELD_MAPPING;

export interface BuildFullBitrixE2eSetupInput {
  dealTitle: string;
  initialStageId: string;
  companyTitle?: string;
}

export interface FullBitrixE2eSetupPayload {
  company: BitrixTestCompanyInput;
  deal: Omit<BitrixTestDealInput, 'companyId'>;
  paidStageId: string;
  expectedInvoiceType: 'FULL';
}

export function assertDealTitleHasTestPrefix(dealTitle: string): boolean {
  return dealTitle.startsWith(DEFAULT_TEST_DEAL_PREFIX);
}

/**
 * FULL deal: Pełna Płatność (718), Faktura (722), no Dopełniająca/Korygująca on invoice type UF.
 */
export function buildFullBitrixE2eSetupPayload(
  input: BuildFullBitrixE2eSetupInput,
): FullBitrixE2eSetupPayload {
  const companyTitle =
    input.companyTitle ?? `${DEFAULT_TEST_DEAL_PREFIX} E2E Buyer Sp. z o.o.`;

  return {
    expectedInvoiceType: 'FULL',
    paidStageId: EVAPREMIUM_BITRIX_PAID_STAGE_ID,
    company: {
      title: companyTitle,
      nip: '1111111111',
      street: 'ul. Testowa 1',
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    },
    deal: {
      title: input.dealTitle,
      stageId: input.initialStageId,
      opportunity: 1400,
      customFields: {
        [M.documentTypeField]: M.documentTypeInvoiceValueId,
        [M.paymentFormField]: M.paymentFormFullValueId,
        [M.shippingCostField]: 50,
      },
      productRows: [
        {
          productName: 'Dywanik bagażnika',
          quantity: 1,
          price: 150,
        },
      ],
    },
  };
}

export function resolveBitrixE2eDealTitle(
  rawConfig: Record<string, string | undefined>,
  testDealPrefix: string,
): string {
  const label = rawConfig.LIVE_TEST_DEAL_LABEL?.trim();
  if (label && label.length > 0) {
    return label;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${testDealPrefix} E2E FULL setup ${stamp}`;
}
