import { advanceInvoiceDryRunContext } from '../../fixtures/advance-invoice.context';
import type {
  AdvanceLiveTestScenarioContext,
  FinalLiveTestScenarioContext,
} from '../../fixtures/scenario-context.types';

/**
 * Builds ADVANCE Bitrix context for seeding a FINAL matrix case on the same deal.
 * Reuses FINAL products/buyer/title; advance amount follows documented ADVANCE fixture default.
 */
export function buildMatrixFinalAdvanceSeedContext(
  finalContext: FinalLiveTestScenarioContext,
  dealTitle: string,
): AdvanceLiveTestScenarioContext {
  return {
    ...advanceInvoiceDryRunContext,
    testDealTitle: dealTitle,
    products: [...finalContext.products],
    buyer: { ...finalContext.buyer },
  };
}
