import type { AdvanceLiveTestScenarioContext } from './scenario-context.types';

export const advanceInvoiceDryRunContext: AdvanceLiveTestScenarioContext = {
  scenarioId: 'advance',
  invoiceType: 'ADVANCE',
  testDealTitle: '[TEST] Live test ADVANCE invoice (dry-run)',
  bitrixDealId: 'dry-run-deal-advance-0001',
  idempotencyKey: 'dry-run-deal-advance-0001:ADVANCE',
  advanceAmountPln: '500.00',
  description:
    'Local dry-run fixture for ADVANCE invoice: deal with valid advance amount field.',
};
