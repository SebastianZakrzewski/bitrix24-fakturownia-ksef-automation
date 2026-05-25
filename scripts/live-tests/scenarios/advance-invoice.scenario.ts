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
    return {
      status: 'PLACEHOLDER_SKIPPED',
      message:
        'ADVANCE invoice live test is not implemented yet. No external side effects were executed.',
    };
  },
};
