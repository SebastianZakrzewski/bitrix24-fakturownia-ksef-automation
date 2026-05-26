import {
  BITRIX_PAID_STAGE_ID,
  BITRIX_PAYMENT_FORM_ADVANCE_VALUE_ID,
  EXPECTED_DRY_RUN_EXTERNAL_STEPS_SKIPPED,
} from './fixture-common';
import type { AdvanceLiveTestScenarioContext } from './scenario-context.types';

export const advanceInvoiceDryRunContext: AdvanceLiveTestScenarioContext = {
  testContextId: 'test-context-advance-001',
  scenarioId: 'advance',
  scenarioType: 'ADVANCE',
  invoiceType: 'ADVANCE',
  testDealTitle: '[TEST] Dry-run ADVANCE invoice deal',
  bitrixDealId: '[TEST]-ADVANCE-001',
  idempotencyKey: '[TEST]-ADVANCE-001:ADVANCE',
  paidStageId: BITRIX_PAID_STAGE_ID,
  paymentFormValueId: BITRIX_PAYMENT_FORM_ADVANCE_VALUE_ID,
  advanceAmountPln: '500.00',
  buyer: {
    companyName: '[TEST] Demo Buyer Sp. z o.o.',
    nip: '2222222222',
    street: 'ul. Testowa 2',
    postalCode: '00-002',
    city: 'Kraków',
    country: 'PL',
  },
  products: [
    {
      name: 'Dywaniki Evapremium',
      quantity: 1,
      unit: 'szt.',
      unitPricePln: '2000.00',
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
    'Local dry-run fixture for ADVANCE: paid stage PREPARATION, advance amount 500.00 PLN, external steps skipped.',
};
