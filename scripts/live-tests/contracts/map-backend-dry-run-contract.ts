import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import { assertSyntheticFixtureData } from '../fixtures/fixture-common';
import {
  backendDryRunContractSchema,
  type BackendDryRunContract,
} from './backend-dry-run-contract.types';

export const DEFAULT_DRY_RUN_TRIGGERED_AT = '2026-05-26T12:00:00.000Z';

export interface MapBackendDryRunContractOptions {
  triggeredAt?: string;
}

function isSyntheticBuyer(context: LiveTestScenarioContext): boolean {
  const buyer = context.buyer;
  if (!buyer.companyName.startsWith('[TEST]')) {
    return false;
  }

  try {
    assertSyntheticFixtureData(buyer.companyName);
    assertSyntheticFixtureData(buyer.nip);
    assertSyntheticFixtureData(buyer.street);
    assertSyntheticFixtureData(buyer.city);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps local live-test fixture to a BitrixTriggerRequestDto-shaped dry-run contract.
 * Does not call backend HTTP or use cases.
 */
export function mapBackendDryRunContract(
  context: LiveTestScenarioContext,
  options: MapBackendDryRunContractOptions = {},
): BackendDryRunContract {
  const triggeredAt = options.triggeredAt ?? DEFAULT_DRY_RUN_TRIGGERED_AT;
  const hasAdvanceAmount =
    'advanceAmountPln' in context && Boolean(context.advanceAmountPln);
  const hasPreviousAdvanceInvoiceId =
    ('previousAdvanceInvoiceId' in context &&
      Boolean(context.previousAdvanceInvoiceId)) ||
    ('priorAdvanceProcessReference' in context &&
      Boolean(
        (context as { priorAdvanceProcessReference?: string })
          .priorAdvanceProcessReference,
      ));

  const contract: BackendDryRunContract = {
    mode: 'DRY_RUN',
    scenarioType: context.scenarioType,
    expectedInvoiceType: context.scenarioType,
    trigger: {
      bitrix_deal_id: context.bitrixDealId,
      trigger_source: 'BITRIX24_STAGE_CHANGE',
      trigger_stage_id: context.paidStageId,
      triggered_at: triggeredAt,
    },
    fixtureContext: {
      fixtureId: context.testContextId,
      bitrixDealId: context.bitrixDealId,
      hasSyntheticBuyer: isSyntheticBuyer(context),
      hasProducts: context.products.length > 0,
      ...(hasAdvanceAmount ? { hasAdvanceAmount: true } : {}),
      ...(hasPreviousAdvanceInvoiceId
        ? { hasPreviousAdvanceInvoiceId: true }
        : {}),
    },
    executionPolicy: {
      backendEndpointAllowed: false,
      useCaseExecutionAllowed: false,
      dbWriteAllowed: false,
      externalSideEffectsAllowed: false,
    },
  };

  return backendDryRunContractSchema.parse(contract);
}
