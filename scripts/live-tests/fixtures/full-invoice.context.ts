import type { LiveTestScenarioContext } from './scenario-context.types';

export const fullInvoiceDryRunContext: LiveTestScenarioContext = {
  scenarioId: 'full',
  invoiceType: 'FULL',
  testDealTitle: '[TEST] Live test FULL invoice (dry-run)',
  bitrixDealId: 'dry-run-deal-full-0001',
  idempotencyKey: 'dry-run-deal-full-0001:FULL',
  description:
    'Local dry-run fixture for FULL invoice: paid-stage deal with company NIP and product rows.',
};
