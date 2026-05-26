import { readFileSync } from 'fs';
import { join } from 'path';
import { advanceInvoiceDryRunContext } from '../fixtures/advance-invoice.context';
import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import type {
  FinalLiveTestScenarioContext,
  LiveTestScenarioContext,
} from '../fixtures/scenario-context.types';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { assertDryRunReport } from '../report/assert-dry-run-report';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import {
  DEFAULT_DRY_RUN_TRIGGERED_AT,
  mapBackendDryRunContract,
} from './map-backend-dry-run-contract';
import {
  BackendDryRunContractValidationError,
  validateBackendDryRunContract,
} from './validate-backend-dry-run-contract';
import type { BackendDryRunContract } from './backend-dry-run-contract.types';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
  LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: false,
};

const FORBIDDEN_CONTRACT_IMPORT_PATTERNS = [
  /modules\/invoices\/use-cases/i,
  /\/repositories\//i,
  /\bfrom\s+['"][^'"]*\/src\//,
  /\bCreateInvoiceFromBitrixDealUseCase\b/,
];

function extractImportLines(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => /^\s*import\s+/.test(line) || /require\(/.test(line));
}

function baseContractFrom(
  context: LiveTestScenarioContext,
): BackendDryRunContract {
  return mapBackendDryRunContract(context, {
    triggeredAt: DEFAULT_DRY_RUN_TRIGGERED_AT,
  });
}

describe('mapBackendDryRunContract', () => {
  it.each([
    ['FULL', fullInvoiceDryRunContext, 'FULL'],
    ['ADVANCE', advanceInvoiceDryRunContext, 'ADVANCE'],
    ['FINAL', finalInvoiceDryRunContext, 'FINAL'],
  ] as const)(
    '%s fixture maps to valid backend dry-run contract',
    (_label, fixture, expectedType) => {
      const contract = baseContractFrom(fixture);

      expect(() => validateBackendDryRunContract(contract)).not.toThrow();
      expect(contract.mode).toBe('DRY_RUN');
      expect(contract.scenarioType).toBe(expectedType);
      expect(contract.expectedInvoiceType).toBe(expectedType);
      expect(contract.trigger.bitrix_deal_id).toBe(fixture.bitrixDealId);
      expect(contract.trigger.trigger_source).toBe('BITRIX24_STAGE_CHANGE');
      expect(contract.trigger.trigger_stage_id).toBe(fixture.paidStageId);
      expect(contract.fixtureContext.hasSyntheticBuyer).toBe(true);
      expect(contract.fixtureContext.hasProducts).toBe(true);
      expect(contract.executionPolicy.backendEndpointAllowed).toBe(false);
      expect(contract.executionPolicy.useCaseExecutionAllowed).toBe(false);
      expect(contract.executionPolicy.dbWriteAllowed).toBe(false);
      expect(contract.executionPolicy.externalSideEffectsAllowed).toBe(false);
    },
  );

  it('scenarioType must match expectedInvoiceType', () => {
    const contract = baseContractFrom(fullInvoiceDryRunContext);
    const mismatched: BackendDryRunContract = {
      ...contract,
      expectedInvoiceType: 'ADVANCE',
    };

    expect(() => validateBackendDryRunContract(mismatched)).toThrow(
      BackendDryRunContractValidationError,
    );
  });

  it('missing [TEST] prefix fails contract validation', () => {
    const contract = mapBackendDryRunContract({
      ...fullInvoiceDryRunContext,
      bitrixDealId: 'PROD-DEAL-001',
    });

    expect(() => validateBackendDryRunContract(contract)).toThrow(
      expect.objectContaining({ code: 'TRIGGER_DEAL_ID_INVALID' }),
    );
  });

  it('missing trigger_stage_id fails contract validation', () => {
    const contract = baseContractFrom(fullInvoiceDryRunContext);
    contract.trigger.trigger_stage_id = '';

    expect(() => validateBackendDryRunContract(contract)).toThrow(
      expect.objectContaining({ code: 'TRIGGER_STAGE_MISSING' }),
    );
  });

  it('invalid triggered_at fails contract validation', () => {
    const contract = baseContractFrom(fullInvoiceDryRunContext);
    contract.trigger.triggered_at = 'not-a-date';

    expect(() => validateBackendDryRunContract(contract)).toThrow(
      expect.objectContaining({ code: 'TRIGGER_TIMESTAMP_INVALID' }),
    );
  });

  it('ADVANCE without advanceAmount fails contract validation', () => {
    const contract = baseContractFrom({
      ...advanceInvoiceDryRunContext,
      advanceAmountPln: '',
    } as typeof advanceInvoiceDryRunContext);

    expect(() => validateBackendDryRunContract(contract)).toThrow(
      expect.objectContaining({ code: 'ADVANCE_AMOUNT_MISSING' }),
    );
  });

  it('FINAL without prior advance reference fails contract validation', () => {
    const invalidFinalContext: FinalLiveTestScenarioContext = {
      ...finalInvoiceDryRunContext,
      previousAdvanceInvoiceId: '',
      priorAdvanceProcessReference: '',
    };
    const contract = mapBackendDryRunContract(invalidFinalContext);

    expect(() => validateBackendDryRunContract(contract)).toThrow(
      expect.objectContaining({ code: 'FINAL_PRIOR_ADVANCE_MISSING' }),
    );
  });

  it('execution policy must keep all execution flags false', () => {
    const contract = baseContractFrom(fullInvoiceDryRunContext);
    contract.executionPolicy.backendEndpointAllowed = true as false;

    expect(() => validateBackendDryRunContract(contract)).toThrow(
      expect.objectContaining({ code: 'EXECUTION_POLICY_INVALID' }),
    );
  });

  it('reports include backend contract section and pass strict assertions', async () => {
    const scenario = fullInvoiceScenario;
    const scenarioResult = await scenario.run();
    const report = buildLiveTestReport({
      scenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, scenario.safetyContext),
      startedAt: new Date(),
      finishedAt: new Date(),
      reportWritten: true,
      smokeReadinessConfig: {},
    });

    expect(report.backendContract.contractValidationStatus).toBe('PASSED');
    expect(() => assertDryRunReport(report, 'full')).not.toThrow();
  });

  it('contract module does not import backend use cases, repositories, or DB clients', () => {
    const files = [
      'backend-dry-run-contract.types.ts',
      'map-backend-dry-run-contract.ts',
      'validate-backend-dry-run-contract.ts',
      'to-backend-contract-report.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      for (const line of extractImportLines(source)) {
        for (const pattern of FORBIDDEN_CONTRACT_IMPORT_PATTERNS) {
          expect(line).not.toMatch(pattern);
        }
      }
      expect(source).not.toMatch(/\.\.\/\.\.\/src\//);
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
