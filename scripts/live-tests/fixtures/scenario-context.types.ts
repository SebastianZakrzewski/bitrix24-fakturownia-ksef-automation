import type { LiveTestInvoiceType } from '../types/live-test-report.types';

export interface LiveTestScenarioContext {
  scenarioId: string;
  invoiceType: LiveTestInvoiceType;
  testDealTitle: string;
  bitrixDealId: string;
  idempotencyKey: string;
  description: string;
}

export interface AdvanceLiveTestScenarioContext extends LiveTestScenarioContext {
  invoiceType: 'ADVANCE';
  advanceAmountPln: string;
}

export interface FinalLiveTestScenarioContext extends LiveTestScenarioContext {
  invoiceType: 'FINAL';
  priorAdvanceProcessReference: string;
}
