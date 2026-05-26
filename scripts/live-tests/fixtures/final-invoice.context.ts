import type { FinalLiveTestScenarioContext } from './scenario-context.types';

export const finalInvoiceDryRunContext: FinalLiveTestScenarioContext = {
  scenarioId: 'final',
  invoiceType: 'FINAL',
  testDealTitle: '[TEST] Live test FINAL invoice (dry-run)',
  bitrixDealId: 'dry-run-deal-final-0001',
  idempotencyKey: 'dry-run-deal-final-0001:FINAL',
  priorAdvanceProcessReference: 'dry-run-deal-final-0001:ADVANCE',
  description:
    'Local dry-run fixture for FINAL invoice: deal with prior successful ADVANCE process reference.',
};
