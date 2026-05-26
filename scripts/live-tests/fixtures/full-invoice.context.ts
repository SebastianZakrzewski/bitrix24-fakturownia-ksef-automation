import {
  BITRIX_PAID_STAGE_ID,
  BITRIX_PAYMENT_FORM_FULL_VALUE_ID,
  EXPECTED_DRY_RUN_EXTERNAL_STEPS_SKIPPED,
} from './fixture-common';
import type { LiveTestScenarioContext } from './scenario-context.types';

export const fullInvoiceDryRunContext: LiveTestScenarioContext = {
  testContextId: 'test-context-full-001',
  scenarioId: 'full',
  scenarioType: 'FULL',
  invoiceType: 'FULL',
  testDealTitle: '[TEST] Dry-run FULL invoice deal',
  bitrixDealId: '[TEST]-FULL-001',
  idempotencyKey: '[TEST]-FULL-001:FULL',
  paidStageId: BITRIX_PAID_STAGE_ID,
  paymentFormValueId: BITRIX_PAYMENT_FORM_FULL_VALUE_ID,
  buyer: {
    companyName: '[TEST] Demo Buyer Sp. z o.o.',
    nip: '1111111111',
    street: 'ul. Testowa 1',
    postalCode: '00-001',
    city: 'Warszawa',
    country: 'PL',
  },
  products: [
    {
      name: 'Dywaniki Evapremium',
      quantity: 1,
      unit: 'szt.',
      unitPricePln: '1200.00',
      vatRate: '23',
    },
    {
      name: 'Dywanik bagażnika',
      quantity: 1,
      unit: 'szt.',
      unitPricePln: '150.00',
      vatRate: '23',
    },
    {
      name: 'Wysyłka',
      quantity: 1,
      unit: 'szt.',
      unitPricePln: '50.00',
      vatRate: '23',
    },
  ],
  expectedExternalStepsSkipped: EXPECTED_DRY_RUN_EXTERNAL_STEPS_SKIPPED,
  description:
    'Local dry-run fixture for FULL: paid stage PREPARATION, synthetic buyer NIP/address, product lines, external steps skipped.',
};
