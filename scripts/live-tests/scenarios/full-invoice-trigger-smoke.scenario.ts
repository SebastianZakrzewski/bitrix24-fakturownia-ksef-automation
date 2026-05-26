import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { executeLiveTriggerSmokeScenario } from '../execution/execute-live-trigger-smoke-scenario';
import { parseLiveTestEnv } from '../live-test-env';
import type { LiveTestScenario } from './scenario.types';

export const fullInvoiceTriggerSmokeScenario: LiveTestScenario = {
  id: 'full',
  invoiceType: 'FULL',
  safetyContext: {
    requiresExternalSideEffects: true,
    requiresTestDealCreation: false,
    scenarioCount: 1,
    requestsDeleteOrCancel: false,
  },
  async run() {
    const env = parseLiveTestEnv(process.env);
    return executeLiveTriggerSmokeScenario({
      env,
      context: fullInvoiceDryRunContext,
    });
  },
};
