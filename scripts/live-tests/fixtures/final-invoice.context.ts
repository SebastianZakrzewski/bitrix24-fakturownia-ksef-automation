import {
  BITRIX_INVOICE_DOCUMENT_TYPE_FINAL_VALUE_ID,
  BITRIX_PAID_STAGE_ID,
  BITRIX_PAYMENT_FORM_FULL_VALUE_ID,
  EXPECTED_DRY_RUN_EXTERNAL_STEPS_SKIPPED,
} from './fixture-common';
import type { FinalLiveTestScenarioContext } from './scenario-context.types';

export const finalInvoiceDryRunContext: FinalLiveTestScenarioContext = {
  testContextId: 'test-context-final-001',
  scenarioId: 'final',
  scenarioType: 'FINAL',
  invoiceType: 'FINAL',
  testDealTitle: '[TEST] Dry-run FINAL invoice deal',
  bitrixDealId: '[TEST]-FINAL-001',
  idempotencyKey: '[TEST]-FINAL-001:FINAL',
  paidStageId: BITRIX_PAID_STAGE_ID,
  paymentFormValueId: BITRIX_PAYMENT_FORM_FULL_VALUE_ID,
  invoiceDocumentTypeValueId: BITRIX_INVOICE_DOCUMENT_TYPE_FINAL_VALUE_ID,
  previousAdvanceInvoiceId: 'fakturownia-advance-sim-0001',
  priorAdvanceProcessReference: '[TEST]-FINAL-001:ADVANCE',
  buyer: {
    companyName: '[TEST] Demo Buyer Sp. z o.o.',
    nip: '3333333333',
    street: 'ul. Testowa 3',
    postalCode: '00-003',
    city: 'Gdańsk',
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
      name: 'Dywanik bagażnika',
      quantity: 1,
      unit: 'szt.',
      unitPricePln: '150.00',
      vatRate: '23',
    },
  ],
  expectedExternalStepsSkipped: EXPECTED_DRY_RUN_EXTERNAL_STEPS_SKIPPED,
  description:
    'Local dry-run fixture for FINAL: Dopełniająca (1328) + Pełna Płatność (718), simulated prior advance invoice reference.',
};
