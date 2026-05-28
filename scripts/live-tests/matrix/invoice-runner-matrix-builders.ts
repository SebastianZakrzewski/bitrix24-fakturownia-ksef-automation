import { advanceInvoiceDryRunContext } from '../fixtures/advance-invoice.context';
import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import type {
  AdvanceLiveTestScenarioContext,
  FinalLiveTestScenarioContext,
  LiveTestProductLineFixture,
  LiveTestScenarioContext,
} from '../fixtures/scenario-context.types';

function cloneFull(
  overrides: Partial<LiveTestScenarioContext> & {
    products?: LiveTestProductLineFixture[];
  } = {},
): LiveTestScenarioContext {
  return {
    ...fullInvoiceDryRunContext,
    ...overrides,
    buyer: { ...fullInvoiceDryRunContext.buyer, ...overrides.buyer },
    products: overrides.products ?? [...fullInvoiceDryRunContext.products],
  };
}

function cloneAdvance(
  overrides: Partial<AdvanceLiveTestScenarioContext> & {
    products?: LiveTestProductLineFixture[];
  } = {},
): AdvanceLiveTestScenarioContext {
  return {
    ...advanceInvoiceDryRunContext,
    ...overrides,
    buyer: { ...advanceInvoiceDryRunContext.buyer, ...overrides.buyer },
    products: overrides.products ?? [...advanceInvoiceDryRunContext.products],
  };
}

function cloneFinal(
  overrides: Partial<FinalLiveTestScenarioContext> & {
    products?: LiveTestProductLineFixture[];
  } = {},
): FinalLiveTestScenarioContext {
  return {
    ...finalInvoiceDryRunContext,
    ...overrides,
    buyer: { ...finalInvoiceDryRunContext.buyer, ...overrides.buyer },
    products: overrides.products ?? [...finalInvoiceDryRunContext.products],
  };
}

const productLine = (
  name: string,
  unitPricePln: string,
  quantity = 1,
  vatRate = '23',
): LiveTestProductLineFixture => ({
  name,
  quantity,
  unit: 'szt.',
  unitPricePln,
  vatRate,
});

export const invoiceRunnerMatrixBuilders = {
  fullBase: (): LiveTestScenarioContext => cloneFull(),
  fullWithId: (suffix: string): LiveTestScenarioContext =>
    cloneFull({
      testContextId: `test-context-full-${suffix}`,
      bitrixDealId: `[TEST]-FULL-${suffix}`,
      idempotencyKey: `[TEST]-FULL-${suffix}:FULL`,
      testDealTitle: `[TEST] Dry-run FULL invoice deal ${suffix}`,
    }),
  fullWithProducts: (products: LiveTestProductLineFixture[]): LiveTestScenarioContext =>
    cloneFull({ products }),
  fullWithBuyerNip: (nip: string): LiveTestScenarioContext =>
    cloneFull({ buyer: { ...fullInvoiceDryRunContext.buyer, nip } }),
  fullInvalidAdvanceField: (): LiveTestScenarioContext =>
    ({
      ...cloneFull(),
      advanceAmountPln: '100.00',
    }) as LiveTestScenarioContext,
  fullInvalidPriorAdvanceField: (): LiveTestScenarioContext =>
    ({
      ...cloneFull(),
      previousAdvanceInvoiceId: 'sim-advance-001',
    }) as LiveTestScenarioContext,

  advanceBase: (): AdvanceLiveTestScenarioContext => cloneAdvance(),
  advanceWithId: (suffix: string, advanceAmountPln: string): AdvanceLiveTestScenarioContext =>
    cloneAdvance({
      testContextId: `test-context-advance-${suffix}`,
      bitrixDealId: `[TEST]-ADVANCE-${suffix}`,
      idempotencyKey: `[TEST]-ADVANCE-${suffix}:ADVANCE`,
      testDealTitle: `[TEST] Dry-run ADVANCE invoice deal ${suffix}`,
      advanceAmountPln,
    }),
  advanceWithAmount: (advanceAmountPln: string): AdvanceLiveTestScenarioContext =>
    cloneAdvance({ advanceAmountPln }),
  advanceWithProducts: (
    products: LiveTestProductLineFixture[],
  ): AdvanceLiveTestScenarioContext => cloneAdvance({ products }),
  finalWithProducts: (
    products: LiveTestProductLineFixture[],
  ): FinalLiveTestScenarioContext => cloneFinal({ products }),
  advanceMissingAmount: (): AdvanceLiveTestScenarioContext => {
    const context = cloneAdvance();
    delete (context as { advanceAmountPln?: string }).advanceAmountPln;
    return context;
  },
  advanceEmptyAmount: (): AdvanceLiveTestScenarioContext =>
    cloneAdvance({ advanceAmountPln: '' }),

  finalBase: (): FinalLiveTestScenarioContext => cloneFinal(),
  finalWithId: (
    suffix: string,
    previousAdvanceInvoiceId: string,
  ): FinalLiveTestScenarioContext =>
    cloneFinal({
      testContextId: `test-context-final-${suffix}`,
      bitrixDealId: `[TEST]-FINAL-${suffix}`,
      idempotencyKey: `[TEST]-FINAL-${suffix}:FINAL`,
      testDealTitle: `[TEST] Dry-run FINAL invoice deal ${suffix}`,
      previousAdvanceInvoiceId,
      priorAdvanceProcessReference: `[TEST]-FINAL-${suffix}:ADVANCE`,
    }),
  finalMissingPriorAdvance: (): FinalLiveTestScenarioContext =>
    cloneFinal({
      previousAdvanceInvoiceId: '',
      priorAdvanceProcessReference: '',
    }),
  finalOnlyProcessReference: (): FinalLiveTestScenarioContext =>
    cloneFinal({ previousAdvanceInvoiceId: '' }),

  productLine,
};
