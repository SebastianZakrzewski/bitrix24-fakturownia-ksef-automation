import type { LiveTestInvoiceType } from '../types/live-test-report.types';

export interface LiveTestBuyerFixture {
  companyName: string;
  nip: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface LiveTestProductLineFixture {
  name: string;
  quantity: number;
  unit: string;
  unitPricePln: string;
  vatRate: string;
}

export interface LiveTestScenarioContext {
  testContextId: string;
  scenarioId: string;
  scenarioType: LiveTestInvoiceType;
  invoiceType: LiveTestInvoiceType;
  testDealTitle: string;
  bitrixDealId: string;
  idempotencyKey: string;
  paidStageId: string;
  paymentFormValueId: string;
  invoiceDocumentTypeValueId?: string;
  buyer: LiveTestBuyerFixture;
  products: LiveTestProductLineFixture[];
  expectedExternalStepsSkipped: readonly string[];
  description: string;
}

export interface AdvanceLiveTestScenarioContext extends LiveTestScenarioContext {
  scenarioType: 'ADVANCE';
  invoiceType: 'ADVANCE';
  advanceAmountPln: string;
}

export interface FinalLiveTestScenarioContext extends LiveTestScenarioContext {
  scenarioType: 'FINAL';
  invoiceType: 'FINAL';
  previousAdvanceInvoiceId: string;
  priorAdvanceProcessReference: string;
}
