import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import type { LiveTestScenario } from './scenario.types';

export const fullInvoiceScenario: LiveTestScenario = {
  id: 'full',
  invoiceType: 'FULL',
  safetyContext: {
    requiresExternalSideEffects: false,
    requiresTestDealCreation: false,
    scenarioCount: 1,
    requestsDeleteOrCancel: false,
  },
  async run() {
    return executeDryRunScenario({ context: fullInvoiceDryRunContext });
  },
};
