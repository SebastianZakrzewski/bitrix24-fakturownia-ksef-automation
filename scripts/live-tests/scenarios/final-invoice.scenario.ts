import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import type { LiveTestScenario } from './scenario.types';

export const finalInvoiceScenario: LiveTestScenario = {
  id: 'final',
  invoiceType: 'FINAL',
  safetyContext: {
    requiresExternalSideEffects: false,
    requiresTestDealCreation: false,
    scenarioCount: 1,
    requestsDeleteOrCancel: false,
  },
  async run() {
    return executeDryRunScenario({ context: finalInvoiceDryRunContext });
  },
};
