import { advanceInvoiceDryRunContext } from '../fixtures/advance-invoice.context';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import type { LiveTestScenario } from './scenario.types';

export const advanceInvoiceScenario: LiveTestScenario = {
  id: 'advance',
  invoiceType: 'ADVANCE',
  safetyContext: {
    requiresExternalSideEffects: false,
    requiresTestDealCreation: false,
    scenarioCount: 1,
    requestsDeleteOrCancel: false,
  },
  async run() {
    return executeDryRunScenario({ context: advanceInvoiceDryRunContext });
  },
};
