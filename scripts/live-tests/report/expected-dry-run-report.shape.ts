import { DRY_RUN_STEP_NAMES } from '../execution/dry-run-steps';
import { BITRIX_PAID_STAGE_ID } from '../fixtures/fixture-common';
import { liveTestFixtureByScenarioId } from '../fixtures/fixture-registry';
import type { LiveTestInvoiceType } from '../types/live-test-report.types';

export type ExpectedDryRunScenarioId = keyof typeof liveTestFixtureByScenarioId;

export interface ExpectedDryRunReportRequirements {
  scenarioId: ExpectedDryRunScenarioId;
  scenarioType: LiveTestInvoiceType;
  testContextId: string;
  bitrixDealId: string;
  paidStageId: string;
  requiresAdvanceAmount: boolean;
  requiresPreviousAdvanceInvoiceId: boolean;
  productCount: number;
}

export const EXPECTED_DRY_RUN_REPORT_REQUIREMENTS: Record<
  ExpectedDryRunScenarioId,
  ExpectedDryRunReportRequirements
> = {
  full: {
    scenarioId: 'full',
    scenarioType: 'FULL',
    testContextId: liveTestFixtureByScenarioId.full.testContextId,
    bitrixDealId: liveTestFixtureByScenarioId.full.bitrixDealId,
    paidStageId: BITRIX_PAID_STAGE_ID,
    requiresAdvanceAmount: false,
    requiresPreviousAdvanceInvoiceId: false,
    productCount: liveTestFixtureByScenarioId.full.products.length,
  },
  advance: {
    scenarioId: 'advance',
    scenarioType: 'ADVANCE',
    testContextId: liveTestFixtureByScenarioId.advance.testContextId,
    bitrixDealId: liveTestFixtureByScenarioId.advance.bitrixDealId,
    paidStageId: BITRIX_PAID_STAGE_ID,
    requiresAdvanceAmount: true,
    requiresPreviousAdvanceInvoiceId: false,
    productCount: liveTestFixtureByScenarioId.advance.products.length,
  },
  final: {
    scenarioId: 'final',
    scenarioType: 'FINAL',
    testContextId: liveTestFixtureByScenarioId.final.testContextId,
    bitrixDealId: liveTestFixtureByScenarioId.final.bitrixDealId,
    paidStageId: BITRIX_PAID_STAGE_ID,
    requiresAdvanceAmount: false,
    requiresPreviousAdvanceInvoiceId: true,
    productCount: liveTestFixtureByScenarioId.final.products.length,
  },
};

export const REQUIRED_DRY_RUN_SCENARIO_STEP_STATUSES: Record<string, string> = {
  [DRY_RUN_STEP_NAMES.VALIDATE_SAFETY_GUARDS]: 'PASSED',
  [DRY_RUN_STEP_NAMES.PREPARE_TEST_CONTEXT]: 'PASSED',
  [DRY_RUN_STEP_NAMES.SIMULATE_BITRIX_DEAL_SETUP]: 'SKIPPED_NOT_EXECUTED',
  [DRY_RUN_STEP_NAMES.SIMULATE_BACKEND_WORKFLOW]: 'BACKEND_DRY_RUN_SIMULATED',
  [DRY_RUN_STEP_NAMES.SIMULATE_FAKTUROWNIA_ORDER_INVOICE]: 'SKIPPED_NOT_EXECUTED',
  [DRY_RUN_STEP_NAMES.MARK_KSEF]: 'MANUAL_REQUIRED',
  [DRY_RUN_STEP_NAMES.MARK_BITRIX_SYNC]: 'NOT_TESTED_YET',
  [DRY_RUN_STEP_NAMES.WRITE_REPORT]: 'PASSED',
};

export const REQUIRED_DRY_RUN_INTEGRATION_STATUSES = {
  ksef: 'MANUAL_REQUIRED',
  bitrixSync: 'NOT_TESTED_YET',
  bitrixDealSetup: 'SKIPPED_NOT_EXECUTED',
  backendWorkflow: 'BACKEND_DRY_RUN_SIMULATED',
  fakturowniaOrder: 'SKIPPED_NOT_EXECUTED',
  fakturowniaInvoice: 'SKIPPED_NOT_EXECUTED',
  database: 'SKIPPED_NOT_EXECUTED',
} as const;
