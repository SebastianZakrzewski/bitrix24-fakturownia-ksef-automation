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
    return {
      status: 'PLACEHOLDER_SKIPPED',
      message:
        'FINAL invoice live test is not implemented yet. No external side effects were executed.',
    };
  },
};
