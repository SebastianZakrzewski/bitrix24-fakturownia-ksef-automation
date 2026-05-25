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
    return {
      status: 'PLACEHOLDER_SKIPPED',
      message:
        'FULL invoice live test is not implemented yet. No external side effects were executed.',
    };
  },
};
