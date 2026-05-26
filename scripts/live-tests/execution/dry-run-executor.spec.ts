import { advanceInvoiceScenario } from '../scenarios/advance-invoice.scenario';
import { finalInvoiceScenario } from '../scenarios/final-invoice.scenario';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { advanceInvoiceDryRunContext } from '../fixtures/advance-invoice.context';
import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { DRY_RUN_STEP_NAMES } from './dry-run-steps';
import { executeDryRunScenario } from './dry-run-executor';

describe('executeDryRunScenario', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['full', fullInvoiceDryRunContext, fullInvoiceScenario],
    ['advance', advanceInvoiceDryRunContext, advanceInvoiceScenario],
    ['final', finalInvoiceDryRunContext, finalInvoiceScenario],
  ] as const)(
    'runs %s dry-run without external calls',
    async (_label, context, scenario) => {
      const result = await executeDryRunScenario({ context });
      const scenarioResult = await scenario.run();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.externalSideEffectsExecuted).toBe(false);
      expect(scenarioResult.externalSideEffectsExecuted).toBe(false);
      expect(result.status).toBe('DRY_RUN_COMPLETED');
      expect(result.executionMode).toBe('DRY_RUN');
    },
  );

  it('records expected dry-run steps and fixed statuses', () => {
    const result = executeDryRunScenario({ context: fullInvoiceDryRunContext });

    return expect(result).resolves.toMatchObject({
      externalSideEffectsExecuted: false,
      steps: expect.arrayContaining([
        expect.objectContaining({
          name: DRY_RUN_STEP_NAMES.VALIDATE_SAFETY_GUARDS,
          status: 'PASSED',
        }),
        expect.objectContaining({
          name: DRY_RUN_STEP_NAMES.PREPARE_TEST_CONTEXT,
          status: 'PASSED',
        }),
        expect.objectContaining({
          name: DRY_RUN_STEP_NAMES.SIMULATE_BITRIX_DEAL_SETUP,
          status: 'SKIPPED_NOT_EXECUTED',
        }),
        expect.objectContaining({
          name: DRY_RUN_STEP_NAMES.SIMULATE_BACKEND_WORKFLOW,
          status: 'SKIPPED_NOT_EXECUTED',
        }),
        expect.objectContaining({
          name: DRY_RUN_STEP_NAMES.SIMULATE_FAKTUROWNIA_ORDER_INVOICE,
          status: 'SKIPPED_NOT_EXECUTED',
        }),
        expect.objectContaining({
          name: DRY_RUN_STEP_NAMES.MARK_KSEF,
          status: 'MANUAL_REQUIRED',
        }),
        expect.objectContaining({
          name: DRY_RUN_STEP_NAMES.MARK_BITRIX_SYNC,
          status: 'NOT_TESTED_YET',
        }),
      ]),
    });
  });

  it('uses local fixture context only', async () => {
    const result = await executeDryRunScenario({
      context: advanceInvoiceDryRunContext,
    });

    expect(result.context?.bitrixDealId).toMatch(/^\[TEST\]-/);
    expect(result.context?.testContextId).toBe('test-context-advance-001');
    expect(result.context?.testDealTitle).toContain('[TEST]');
    expect(result.context?.idempotencyKey).toContain(':ADVANCE');
  });
});
