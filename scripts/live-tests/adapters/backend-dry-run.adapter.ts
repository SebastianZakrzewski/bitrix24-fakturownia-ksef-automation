import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import { validateBackendDryRunContract } from '../contracts/validate-backend-dry-run-contract';
import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type {
  AdvanceLiveTestScenarioContext,
  FinalLiveTestScenarioContext,
  LiveTestScenarioContext,
} from '../fixtures/scenario-context.types';
import { hasTestDealPrefix } from '../fixtures/fixture-common';
import {
  backendDryRunResultSchema,
  type BackendDryRunResult,
} from './backend-dry-run.types';

export class BackendDryRunAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendDryRunAdapterError';
  }
}

function assertFixtureMatchesScenario(context: LiveTestScenarioContext): void {
  if (context.scenarioType !== context.invoiceType) {
    throw new BackendDryRunAdapterError(
      'Fixture scenarioType must match invoiceType',
    );
  }

  if (!hasTestDealPrefix(context.bitrixDealId)) {
    throw new BackendDryRunAdapterError(
      `Fixture bitrixDealId must use [TEST] prefix (${context.bitrixDealId})`,
    );
  }
}

function assertAdvanceFixture(
  context: LiveTestScenarioContext,
): asserts context is AdvanceLiveTestScenarioContext {
  if (context.scenarioType !== 'ADVANCE') {
    throw new BackendDryRunAdapterError('ADVANCE adapter requires ADVANCE fixture');
  }

  if (!('advanceAmountPln' in context) || !context.advanceAmountPln) {
    throw new BackendDryRunAdapterError(
      'ADVANCE fixture must include advanceAmountPln',
    );
  }
}

function assertFinalFixture(
  context: LiveTestScenarioContext,
): asserts context is FinalLiveTestScenarioContext {
  if (context.scenarioType !== 'FINAL') {
    throw new BackendDryRunAdapterError('FINAL adapter requires FINAL fixture');
  }

  if (!('previousAdvanceInvoiceId' in context) || !context.previousAdvanceInvoiceId) {
    throw new BackendDryRunAdapterError(
      'FINAL fixture must include previousAdvanceInvoiceId',
    );
  }
}

function assertFullFixture(context: LiveTestScenarioContext): void {
  if (context.scenarioType !== 'FULL') {
    throw new BackendDryRunAdapterError('FULL adapter requires FULL fixture');
  }

  if ('advanceAmountPln' in context) {
    throw new BackendDryRunAdapterError('FULL fixture must not include advanceAmountPln');
  }

  if ('previousAdvanceInvoiceId' in context) {
    throw new BackendDryRunAdapterError(
      'FULL fixture must not include previousAdvanceInvoiceId',
    );
  }
}

function buildNotes(context: LiveTestScenarioContext): string[] {
  return [
    'Real backend workflow was not executed.',
    'No HTTP call was made to the backend trigger endpoint.',
    'Backend invoice-from-deal use case was not invoked.',
    'No InvoiceProcess, InvoiceRecord, or InvoiceEvent rows were persisted.',
    'No database write occurred.',
    'No external deal, order, or billing document was persisted.',
    `Validation and mapping were simulated locally from fixture ${context.testContextId}.`,
  ];
}

/**
 * Simulates backend workflow outcome from local fixture data only.
 * Must not import or call backend use cases, controllers, repositories, or HTTP clients.
 */
export interface BackendDryRunWorkflowOutput {
  result: BackendDryRunResult;
  contract: BackendDryRunContract;
}

export function simulateBackendDryRunWorkflow(
  context: LiveTestScenarioContext,
): BackendDryRunWorkflowOutput {
  assertFixtureMatchesScenario(context);

  switch (context.scenarioType) {
    case 'FULL':
      assertFullFixture(context);
      break;
    case 'ADVANCE':
      assertAdvanceFixture(context);
      break;
    case 'FINAL':
      assertFinalFixture(context);
      break;
    default: {
      const exhaustive: never = context.scenarioType;
      throw new BackendDryRunAdapterError(`Unsupported scenario type: ${exhaustive}`);
    }
  }

  const contract = mapBackendDryRunContract(context);
  validateBackendDryRunContract(contract);

  const result: BackendDryRunResult = {
    scenarioType: context.scenarioType,
    expectedInvoiceType: context.scenarioType,
    backendMode: 'DRY_RUN',
    backendWorkflowExecuted: false,
    backendEndpointCalled: false,
    useCaseExecuted: false,
    invoiceProcessCreated: false,
    invoiceRecordCreated: false,
    invoiceEventCreated: false,
    dbWriteExecuted: false,
    validationSimulated: true,
    mappedFromFixture: true,
    resultStatus: 'BACKEND_DRY_RUN_SIMULATED',
    testContextId: context.testContextId,
    bitrixDealId: context.bitrixDealId,
    idempotencyKey: context.idempotencyKey,
    notes: buildNotes(context),
  };

  return {
    result: backendDryRunResultSchema.parse(result),
    contract,
  };
}
