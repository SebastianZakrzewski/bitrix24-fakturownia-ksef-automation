import { readFileSync } from 'fs';
import { join } from 'path';
import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import { resolveScenarioFromCliArg } from './resolve-scenario-from-cli';

describe('scenario selection from CLI/npm script only', () => {
  it.each([
    ['full', 'FULL', 'live-test:full'],
    ['advance', 'ADVANCE', 'live-test:advance'],
    ['final', 'FINAL', 'live-test:final'],
  ] as const)(
    'CLI arg "%s" selects %s invoice type via npm script %s',
    (cliArg, expectedInvoiceType, npmScript) => {
      const scenario = resolveScenarioFromCliArg(cliArg);

      expect(scenario.id).toBe(cliArg);
      expect(scenario.invoiceType).toBe(expectedInvoiceType);

      const packageJson = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
      ) as { scripts: Record<string, string> };

      expect(packageJson.scripts[npmScript]).toContain(
        `run-live-test.ts ${cliArg}`,
      );
    },
  );

  it('does not infer scenario invoice type from fixture idempotency or Bitrix-like fields', async () => {
    const mismatchedContext = {
      ...fullInvoiceDryRunContext,
      scenarioType: 'FINAL' as const,
      invoiceType: 'FINAL' as const,
      idempotencyKey: '[TEST]-FULL-001:FINAL',
      bitrixDealId: '[TEST]-CRM-99999',
    };

    const advanceScenario = resolveScenarioFromCliArg('advance');
    const advanceResult = await advanceScenario.run();
    const mismatchedDryRun = await executeDryRunScenario({
      context: mismatchedContext,
    });

    expect(advanceScenario.invoiceType).toBe('ADVANCE');
    expect(advanceResult.context?.invoiceType).toBe('ADVANCE');
    expect(mismatchedDryRun.context?.invoiceType).toBe('FINAL');
    expect(advanceResult.context?.idempotencyKey).toContain(':ADVANCE');
    expect(advanceResult.context?.idempotencyKey).not.toBe(
      mismatchedContext.idempotencyKey,
    );

    const finalScenario = resolveScenarioFromCliArg('final');
    const finalResult = await finalScenario.run();

    expect(finalScenario.invoiceType).toBe('FINAL');
    expect(finalResult.context?.bitrixDealId).toBe(
      finalInvoiceDryRunContext.bitrixDealId,
    );
    expect(finalResult.context?.bitrixDealId).not.toBe(
      mismatchedContext.bitrixDealId,
    );
  });
});
