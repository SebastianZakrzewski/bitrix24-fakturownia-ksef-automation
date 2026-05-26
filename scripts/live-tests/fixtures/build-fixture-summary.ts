import type {
  AdvanceLiveTestScenarioContext,
  FinalLiveTestScenarioContext,
  LiveTestScenarioContext,
} from './scenario-context.types';

export interface LiveTestBuyerSummary {
  companyName: string;
  nipMasked: string;
  city: string;
  country: string;
}

export interface LiveTestProductSummary {
  name: string;
  quantity: number;
  unitPricePln: string;
}

export interface LiveTestFixtureReportSummary {
  testContextId: string;
  scenarioType: LiveTestScenarioContext['scenarioType'];
  bitrixDealId: string;
  expectedInvoiceType: LiveTestScenarioContext['scenarioType'];
  paidStageId: string;
  buyerSummary: LiveTestBuyerSummary;
  productSummary: LiveTestProductSummary[];
  advanceAmountPln?: string;
  previousAdvanceInvoiceId?: string;
  expectedExternalStepsSkipped: string[];
}

function maskNip(nip: string): string {
  if (nip.length <= 4) {
    return 'TEST-****';
  }

  return `TEST-***${nip.slice(-4)}`;
}

export function buildFixtureReportSummary(
  context: LiveTestScenarioContext,
): LiveTestFixtureReportSummary {
  const summary: LiveTestFixtureReportSummary = {
    testContextId: context.testContextId,
    scenarioType: context.scenarioType,
    bitrixDealId: context.bitrixDealId,
    expectedInvoiceType: context.scenarioType,
    paidStageId: context.paidStageId,
    buyerSummary: {
      companyName: context.buyer.companyName,
      nipMasked: maskNip(context.buyer.nip),
      city: context.buyer.city,
      country: context.buyer.country,
    },
    productSummary: context.products.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPricePln: line.unitPricePln,
    })),
    expectedExternalStepsSkipped: [...context.expectedExternalStepsSkipped],
  };

  if ('advanceAmountPln' in context) {
    summary.advanceAmountPln = (context as AdvanceLiveTestScenarioContext)
      .advanceAmountPln;
  }

  if ('previousAdvanceInvoiceId' in context) {
    summary.previousAdvanceInvoiceId = (
      context as FinalLiveTestScenarioContext
    ).previousAdvanceInvoiceId;
  }

  return summary;
}
