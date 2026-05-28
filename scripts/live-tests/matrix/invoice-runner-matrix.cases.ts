import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { BackendDryRunContractValidationCode } from '../contracts/validate-backend-dry-run-contract';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import { invoiceRunnerMatrixBuilders as B } from './invoice-runner-matrix-builders';
import type { InvoiceRunnerMatrixCase } from './invoice-runner-matrix.types';

function pass(
  id: string,
  invoiceType: InvoiceRunnerMatrixCase['invoiceType'],
  category: InvoiceRunnerMatrixCase['category'],
  description: string,
  context: LiveTestScenarioContext,
): InvoiceRunnerMatrixCase {
  return {
    id,
    invoiceType,
    category,
    description,
    prepare: () => ({ context }),
    expected: { result: 'RUNNER_PASS' },
  };
}

function contractReject(
  id: string,
  invoiceType: InvoiceRunnerMatrixCase['invoiceType'],
  description: string,
  code: BackendDryRunContractValidationCode,
  context: LiveTestScenarioContext,
  mutate: (contract: BackendDryRunContract) => BackendDryRunContract,
): InvoiceRunnerMatrixCase {
  return {
    id,
    invoiceType,
    category: 'contract_guard',
    description,
    prepare: () => ({ context, contractOverride: mutate }),
    expected: { result: 'CONTRACT_REJECT', code },
  };
}

function adapterReject(
  id: string,
  invoiceType: InvoiceRunnerMatrixCase['invoiceType'],
  description: string,
  context: LiveTestScenarioContext,
): InvoiceRunnerMatrixCase {
  return {
    id,
    invoiceType,
    category: 'adapter_guard',
    description,
    prepare: () => ({ context }),
    expected: { result: 'ADAPTER_REJECT' },
  };
}

function backendReject(
  id: string,
  invoiceType: InvoiceRunnerMatrixCase['invoiceType'],
  description: string,
  codes: readonly string[],
): InvoiceRunnerMatrixCase {
  return {
    id,
    invoiceType,
    category: 'backend_validation_guard',
    description,
    prepare: () => ({}),
    expected: { result: 'BACKEND_VALIDATION_REJECT', codes },
  };
}

const FULL_BASE = B.fullBase();

const FULL_CASES: InvoiceRunnerMatrixCase[] = [
  pass('full-001', 'FULL', 'happy_path', 'Baseline FULL dry-run fixture', FULL_BASE),
  pass(
    'full-002',
    'FULL',
    'valid_variant',
    'FULL with single product line',
    B.fullWithProducts([B.productLine('Dywaniki Evapremium', '1200.00')]),
  ),
  pass(
    'full-003',
    'FULL',
    'valid_variant',
    'FULL with five product lines',
    B.fullWithProducts([
      B.productLine('Dywaniki Evapremium', '1200.00'),
      B.productLine('Dywanik bagażnika', '150.00'),
      B.productLine('Wysyłka', '50.00'),
      B.productLine('Akcesorium A', '75.00'),
      B.productLine('Akcesorium B', '25.00'),
    ]),
  ),
  pass(
    'full-004',
    'FULL',
    'valid_variant',
    'FULL with alternate synthetic buyer NIP',
    B.fullWithBuyerNip('4444444444'),
  ),
  pass('full-005', 'FULL', 'valid_variant', 'FULL deal id suffix 002', B.fullWithId('002')),
  pass(
    'full-006',
    'FULL',
    'valid_variant',
    'FULL with quantity greater than one',
    B.fullWithProducts([B.productLine('Dywaniki Evapremium', '400.00', 3)]),
  ),
  pass(
    'full-007',
    'FULL',
    'valid_variant',
    'FULL with 8% VAT product line',
    B.fullWithProducts([B.productLine('Dywaniki Evapremium', '1200.00', 1, '8')]),
  ),
  pass(
    'full-008',
    'FULL',
    'valid_variant',
    'FULL with high unit price',
    B.fullWithProducts([B.productLine('Dywaniki Evapremium', '99999.99')]),
  ),
  pass(
    'full-009',
    'FULL',
    'valid_variant',
    'FULL with decimal unit price',
    B.fullWithProducts([B.productLine('Dywaniki Evapremium', '123.45')]),
  ),
  pass(
    'full-010',
    'FULL',
    'valid_variant',
    'FULL with long product name',
    B.fullWithProducts([
      B.productLine('[TEST] Dywaniki Evapremium premium edition line', '1200.00'),
    ]),
  ),
  pass('full-011', 'FULL', 'valid_variant', 'FULL buyer in alternate city', {
    ...FULL_BASE,
    buyer: { ...FULL_BASE.buyer, city: 'Poznań', postalCode: '60-001' },
  }),
  pass(
    'full-012',
    'FULL',
    'valid_variant',
    'FULL with two product lines',
    B.fullWithProducts([
      B.productLine('Dywaniki Evapremium', '1200.00'),
      B.productLine('Wysyłka', '50.00'),
    ]),
  ),
  pass('full-013', 'FULL', 'valid_variant', 'FULL deal id suffix 003', B.fullWithId('003')),
  pass('full-014', 'FULL', 'valid_variant', 'FULL deal id suffix 004', B.fullWithId('004')),
  pass(
    'full-015',
    'FULL',
    'valid_variant',
    'FULL mixed product basket',
    B.fullWithProducts([
      B.productLine('Dywaniki Evapremium', '1200.00'),
      B.productLine('Montaż', '200.00'),
      B.productLine('Wysyłka', '50.00'),
      B.productLine('Usługa dodatkowa', '99.99'),
    ]),
  ),
  contractReject(
    'full-016',
    'FULL',
    'Reject deal id without [TEST] prefix',
    'TRIGGER_DEAL_ID_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, bitrix_deal_id: 'PROD-FULL-001' },
    }),
  ),
  contractReject(
    'full-017',
    'FULL',
    'Reject missing trigger stage id',
    'TRIGGER_STAGE_MISSING',
    FULL_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, trigger_stage_id: '   ' },
    }),
  ),
  contractReject(
    'full-018',
    'FULL',
    'Reject invalid triggered_at timestamp',
    'TRIGGER_TIMESTAMP_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, triggered_at: 'not-a-date' },
    }),
  ),
  contractReject(
    'full-019',
    'FULL',
    'Reject scenarioType mismatch with expectedInvoiceType',
    'SCENARIO_TYPE_MISMATCH',
    FULL_BASE,
    (contract) => ({ ...contract, expectedInvoiceType: 'ADVANCE' }),
  ),
  contractReject(
    'full-020',
    'FULL',
    'Reject execution policy allowing backend endpoint',
    'EXECUTION_POLICY_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: { ...contract.executionPolicy, backendEndpointAllowed: true as false },
    }),
  ),
  contractReject(
    'full-021',
    'FULL',
    'Reject non-synthetic buyer marker in contract',
    'FIXTURE_SYNTHETIC_BUYER_MISSING',
    FULL_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasSyntheticBuyer: false },
    }),
  ),
  contractReject(
    'full-022',
    'FULL',
    'Reject missing product lines in contract',
    'FIXTURE_PRODUCTS_MISSING',
    FULL_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasProducts: false },
    }),
  ),
  contractReject(
    'full-023',
    'FULL',
    'Reject FULL contract with advance amount flag',
    'FULL_FIXTURE_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasAdvanceAmount: true },
    }),
  ),
  contractReject(
    'full-024',
    'FULL',
    'Reject invalid trigger source',
    'TRIGGER_SOURCE_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      trigger: {
        ...contract.trigger,
        trigger_source: 'MANUAL_RETRY' as 'BITRIX24_STAGE_CHANGE',
      },
    }),
  ),
  contractReject(
    'full-025',
    'FULL',
    'Reject non-dry-run contract mode',
    'MODE_INVALID',
    FULL_BASE,
    (contract) => ({ ...contract, mode: 'LIVE' as 'DRY_RUN' }),
  ),
  contractReject(
    'full-026',
    'FULL',
    'Reject FULL contract with prior advance flag',
    'FULL_FIXTURE_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: {
        ...contract.fixtureContext,
        hasPreviousAdvanceInvoiceId: true,
      },
    }),
  ),
  contractReject(
    'full-027',
    'FULL',
    'Reject execution policy allowing use case execution',
    'EXECUTION_POLICY_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: {
        ...contract.executionPolicy,
        useCaseExecutionAllowed: true as false,
      },
    }),
  ),
  contractReject(
    'full-028',
    'FULL',
    'Reject execution policy allowing DB writes',
    'EXECUTION_POLICY_INVALID',
    FULL_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: { ...contract.executionPolicy, dbWriteAllowed: true as false },
    }),
  ),
  adapterReject(
    'full-029',
    'FULL',
    'Adapter rejects advanceAmountPln on FULL fixture',
    B.fullInvalidAdvanceField(),
  ),
  adapterReject(
    'full-030',
    'FULL',
    'Adapter rejects previousAdvanceInvoiceId on FULL fixture',
    B.fullInvalidPriorAdvanceField(),
  ),
  adapterReject('full-031', 'FULL', 'Adapter rejects scenarioType mismatch in context', {
    ...FULL_BASE,
    scenarioType: 'ADVANCE' as 'FULL',
  }),
  adapterReject('full-032', 'FULL', 'Adapter rejects deal id without [TEST] prefix', {
    ...FULL_BASE,
    bitrixDealId: 'PROD-FULL-002',
  }),
  adapterReject('full-033', 'FULL', 'Adapter rejects invoiceType mismatch in context', {
    ...FULL_BASE,
    invoiceType: 'ADVANCE' as 'FULL',
  }),
  adapterReject('full-034', 'FULL', 'Adapter rejects empty bitrix deal id', {
    ...FULL_BASE,
    bitrixDealId: '',
  }),
  adapterReject('full-035', 'FULL', 'Adapter rejects FINAL scenarioType on FULL fixture', {
    ...FULL_BASE,
    scenarioType: 'FINAL' as 'FULL',
    invoiceType: 'FINAL' as 'FULL',
  }),
  backendReject(
    'full-036',
    'FULL',
    'Backend blocks unresolved invoice type combination',
    ['MISSING_INVOICE_TYPE'],
  ),
  backendReject('full-037', 'FULL', 'Backend blocks deal without company', ['MISSING_COMPANY']),
  backendReject('full-038', 'FULL', 'Backend blocks buyer without NIP', ['MISSING_NIP']),
  backendReject(
    'full-039',
    'FULL',
    'Backend blocks invoice without products',
    ['MISSING_PRODUCTS'],
  ),
  backendReject(
    'full-040',
    'FULL',
    'Backend blocks invoice with invalid product line',
    ['INVALID_PRODUCT_LINE'],
  ),
];

const ADVANCE_BASE = B.advanceBase();

const ADVANCE_CASES: InvoiceRunnerMatrixCase[] = [
  pass('advance-001', 'ADVANCE', 'happy_path', 'Baseline ADVANCE dry-run fixture', ADVANCE_BASE),
  pass('advance-002', 'ADVANCE', 'valid_variant', 'ADVANCE amount 1.00 PLN', B.advanceWithAmount('1.00')),
  pass(
    'advance-003',
    'ADVANCE',
    'valid_variant',
    'ADVANCE amount 100.00 PLN',
    B.advanceWithAmount('100.00'),
  ),
  pass(
    'advance-004',
    'ADVANCE',
    'valid_variant',
    'ADVANCE amount 1000.00 PLN',
    B.advanceWithAmount('1000.00'),
  ),
  pass(
    'advance-005',
    'ADVANCE',
    'valid_variant',
    'ADVANCE amount 5000.00 PLN',
    B.advanceWithAmount('5000.00'),
  ),
  pass(
    'advance-006',
    'ADVANCE',
    'valid_variant',
    'ADVANCE amount 9999.99 PLN',
    B.advanceWithAmount('9999.99'),
  ),
  pass(
    'advance-007',
    'ADVANCE',
    'valid_variant',
    'ADVANCE deal id suffix 002',
    B.advanceWithId('002', '500.00'),
  ),
  pass(
    'advance-008',
    'ADVANCE',
    'valid_variant',
    'ADVANCE with single product',
    B.advanceWithProducts([B.productLine('Dywaniki Evapremium', '2000.00')]),
  ),
  pass(
    'advance-009',
    'ADVANCE',
    'valid_variant',
    'ADVANCE with three products',
    B.advanceWithProducts([
      B.productLine('Dywaniki Evapremium', '2000.00'),
      B.productLine('Wysyłka', '50.00'),
      B.productLine('Montaż', '150.00'),
    ]),
  ),
  pass('advance-010', 'ADVANCE', 'valid_variant', 'ADVANCE buyer alternate NIP', {
    ...B.advanceWithAmount('750.00'),
    buyer: { ...ADVANCE_BASE.buyer, nip: '5555555555' },
  }),
  pass(
    'advance-011',
    'ADVANCE',
    'valid_variant',
    'ADVANCE amount 250.50 PLN',
    B.advanceWithAmount('250.50'),
  ),
  pass(
    'advance-012',
    'ADVANCE',
    'valid_variant',
    'ADVANCE deal id suffix 003',
    B.advanceWithId('003', '300.00'),
  ),
  pass(
    'advance-013',
    'ADVANCE',
    'valid_variant',
    'ADVANCE high quantity product',
    B.advanceWithProducts([B.productLine('Dywaniki Evapremium', '100.00', 10)]),
  ),
  pass(
    'advance-014',
    'ADVANCE',
    'valid_variant',
    'ADVANCE deal id suffix 004',
    B.advanceWithId('004', '1200.00'),
  ),
  pass(
    'advance-015',
    'ADVANCE',
    'valid_variant',
    'ADVANCE amount 0.01 PLN minimum positive',
    B.advanceWithAmount('0.01'),
  ),
  contractReject(
    'advance-016',
    'ADVANCE',
    'Reject deal id without [TEST] prefix',
    'TRIGGER_DEAL_ID_INVALID',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, bitrix_deal_id: 'PROD-ADVANCE-001' },
    }),
  ),
  contractReject(
    'advance-017',
    'ADVANCE',
    'Reject missing trigger stage id',
    'TRIGGER_STAGE_MISSING',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, trigger_stage_id: '' },
    }),
  ),
  contractReject(
    'advance-018',
    'ADVANCE',
    'Reject invalid triggered_at timestamp',
    'TRIGGER_TIMESTAMP_INVALID',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, triggered_at: 'not-a-date' },
    }),
  ),
  contractReject(
    'advance-019',
    'ADVANCE',
    'Reject scenarioType mismatch with expectedInvoiceType',
    'SCENARIO_TYPE_MISMATCH',
    ADVANCE_BASE,
    (contract) => ({ ...contract, expectedInvoiceType: 'FULL' }),
  ),
  contractReject(
    'advance-020',
    'ADVANCE',
    'Reject execution policy allowing external side effects',
    'EXECUTION_POLICY_INVALID',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: {
        ...contract.executionPolicy,
        externalSideEffectsAllowed: true as false,
      },
    }),
  ),
  contractReject(
    'advance-021',
    'ADVANCE',
    'Reject missing advance amount flag in contract',
    'ADVANCE_AMOUNT_MISSING',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasAdvanceAmount: false },
    }),
  ),
  contractReject(
    'advance-022',
    'ADVANCE',
    'Reject non-synthetic buyer marker in contract',
    'FIXTURE_SYNTHETIC_BUYER_MISSING',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasSyntheticBuyer: false },
    }),
  ),
  contractReject(
    'advance-023',
    'ADVANCE',
    'Reject missing product lines in contract',
    'FIXTURE_PRODUCTS_MISSING',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasProducts: false },
    }),
  ),
  contractReject(
    'advance-024',
    'ADVANCE',
    'Reject invalid trigger source',
    'TRIGGER_SOURCE_INVALID',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      trigger: {
        ...contract.trigger,
        trigger_source: 'PANEL_RETRY' as 'BITRIX24_STAGE_CHANGE',
      },
    }),
  ),
  contractReject(
    'advance-025',
    'ADVANCE',
    'Reject non-dry-run contract mode',
    'MODE_INVALID',
    ADVANCE_BASE,
    (contract) => ({ ...contract, mode: 'LIVE' as 'DRY_RUN' }),
  ),
  contractReject(
    'advance-026',
    'ADVANCE',
    'Reject execution policy allowing backend endpoint',
    'EXECUTION_POLICY_INVALID',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: { ...contract.executionPolicy, backendEndpointAllowed: true as false },
    }),
  ),
  contractReject(
    'advance-027',
    'ADVANCE',
    'Reject execution policy allowing use case execution',
    'EXECUTION_POLICY_INVALID',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: {
        ...contract.executionPolicy,
        useCaseExecutionAllowed: true as false,
      },
    }),
  ),
  contractReject(
    'advance-028',
    'ADVANCE',
    'Reject execution policy allowing DB writes',
    'EXECUTION_POLICY_INVALID',
    ADVANCE_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: { ...contract.executionPolicy, dbWriteAllowed: true as false },
    }),
  ),
  adapterReject(
    'advance-029',
    'ADVANCE',
    'Adapter rejects missing advanceAmountPln field',
    B.advanceMissingAmount(),
  ),
  adapterReject(
    'advance-030',
    'ADVANCE',
    'Adapter rejects empty advanceAmountPln field',
    B.advanceEmptyAmount(),
  ),
  adapterReject('advance-031', 'ADVANCE', 'Adapter rejects scenarioType mismatch in context', {
    ...ADVANCE_BASE,
    scenarioType: 'FULL' as 'ADVANCE',
  }),
  adapterReject('advance-032', 'ADVANCE', 'Adapter rejects deal id without [TEST] prefix', {
    ...ADVANCE_BASE,
    bitrixDealId: 'PROD-ADVANCE-002',
  }),
  adapterReject('advance-033', 'ADVANCE', 'Adapter rejects invoiceType mismatch in context', {
    ...ADVANCE_BASE,
    invoiceType: 'FULL' as 'ADVANCE',
  }),
  adapterReject('advance-034', 'ADVANCE', 'Adapter rejects empty bitrix deal id', {
    ...ADVANCE_BASE,
    bitrixDealId: '',
  }),
  adapterReject('advance-035', 'ADVANCE', 'Adapter rejects FINAL scenarioType on ADVANCE fixture', {
    ...ADVANCE_BASE,
    scenarioType: 'FINAL' as 'ADVANCE',
    invoiceType: 'FINAL' as 'ADVANCE',
  }),
  backendReject(
    'advance-036',
    'ADVANCE',
    'Backend blocks ADVANCE without advance amount',
    ['MISSING_ADVANCE_AMOUNT'],
  ),
  backendReject(
    'advance-037',
    'ADVANCE',
    'Backend blocks ADVANCE with zero advance amount',
    ['INVALID_ADVANCE_AMOUNT'],
  ),
  backendReject(
    'advance-038',
    'ADVANCE',
    'Backend blocks ADVANCE with negative advance amount',
    ['INVALID_ADVANCE_AMOUNT'],
  ),
  backendReject('advance-039', 'ADVANCE', 'Backend blocks buyer without NIP', ['MISSING_NIP']),
  backendReject(
    'advance-040',
    'ADVANCE',
    'Backend blocks invoice with invalid product line',
    ['INVALID_PRODUCT_LINE'],
  ),
];

const FINAL_BASE = B.finalBase();

const FINAL_CASES: InvoiceRunnerMatrixCase[] = [
  pass('final-001', 'FINAL', 'happy_path', 'Baseline FINAL dry-run fixture', FINAL_BASE),
  pass(
    'final-002',
    'FINAL',
    'valid_variant',
    'FINAL with alternate prior advance invoice id',
    B.finalWithId('002', 'fakturownia-advance-sim-0002'),
  ),
  pass(
    'final-003',
    'FINAL',
    'valid_variant',
    'FINAL deal id suffix 003',
    B.finalWithId('003', 'fakturownia-advance-sim-0003'),
  ),
  pass(
    'final-004',
    'FINAL',
    'valid_variant',
    'FINAL with single product',
    B.finalWithProducts([B.productLine('Dywaniki Evapremium', '2000.00')]),
  ),
  pass(
    'final-005',
    'FINAL',
    'valid_variant',
    'FINAL with four products',
    B.finalWithProducts([
      B.productLine('Dywaniki Evapremium', '2000.00'),
      B.productLine('Dywanik bagażnika', '150.00'),
      B.productLine('Wysyłka', '50.00'),
      B.productLine('Montaż', '100.00'),
    ]),
  ),
  pass('final-006', 'FINAL', 'valid_variant', 'FINAL buyer alternate NIP', {
    ...FINAL_BASE,
    buyer: { ...FINAL_BASE.buyer, nip: '6666666666' },
  }),
  pass(
    'final-007',
    'FINAL',
    'valid_variant',
    'FINAL deal id suffix 004',
    B.finalWithId('004', 'fakturownia-advance-sim-0004'),
  ),
  pass(
    'final-008',
    'FINAL',
    'valid_variant',
    'FINAL with high unit price product',
    B.finalWithProducts([B.productLine('Dywaniki Evapremium', '50000.00')]),
  ),
  pass(
    'final-009',
    'FINAL',
    'valid_variant',
    'FINAL with decimal unit price',
    B.finalWithProducts([B.productLine('Dywaniki Evapremium', '1999.99')]),
  ),
  pass(
    'final-010',
    'FINAL',
    'valid_variant',
    'FINAL with quantity greater than one',
    B.finalWithProducts([B.productLine('Dywaniki Evapremium', '500.00', 4)]),
  ),
  pass('final-011', 'FINAL', 'valid_variant', 'FINAL buyer alternate city', {
    ...FINAL_BASE,
    buyer: { ...FINAL_BASE.buyer, city: 'Wrocław', postalCode: '50-001' },
  }),
  pass(
    'final-012',
    'FINAL',
    'valid_variant',
    'FINAL deal id suffix 005',
    B.finalWithId('005', 'fakturownia-advance-sim-0005'),
  ),
  pass(
    'final-013',
    'FINAL',
    'valid_variant',
    'FINAL with two products only',
    B.finalWithProducts([
      B.productLine('Dywaniki Evapremium', '2000.00'),
      B.productLine('Wysyłka', '50.00'),
    ]),
  ),
  pass(
    'final-014',
    'FINAL',
    'valid_variant',
    'FINAL with prior advance id variant 0006',
    B.finalWithId('006', 'fakturownia-advance-sim-0006'),
  ),
  pass(
    'final-015',
    'FINAL',
    'valid_variant',
    'FINAL with prior advance id suffix 015',
    B.finalWithId('015', 'fakturownia-advance-sim-0015'),
  ),
  contractReject(
    'final-016',
    'FINAL',
    'Reject deal id without [TEST] prefix',
    'TRIGGER_DEAL_ID_INVALID',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, bitrix_deal_id: 'PROD-FINAL-001' },
    }),
  ),
  contractReject(
    'final-017',
    'FINAL',
    'Reject missing trigger stage id',
    'TRIGGER_STAGE_MISSING',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, trigger_stage_id: '' },
    }),
  ),
  contractReject(
    'final-018',
    'FINAL',
    'Reject invalid triggered_at timestamp',
    'TRIGGER_TIMESTAMP_INVALID',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      trigger: { ...contract.trigger, triggered_at: 'invalid' },
    }),
  ),
  contractReject(
    'final-019',
    'FINAL',
    'Reject scenarioType mismatch with expectedInvoiceType',
    'SCENARIO_TYPE_MISMATCH',
    FINAL_BASE,
    (contract) => ({ ...contract, expectedInvoiceType: 'ADVANCE' }),
  ),
  contractReject(
    'final-020',
    'FINAL',
    'Reject execution policy allowing external side effects',
    'EXECUTION_POLICY_INVALID',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: {
        ...contract.executionPolicy,
        externalSideEffectsAllowed: true as false,
      },
    }),
  ),
  contractReject(
    'final-021',
    'FINAL',
    'Reject missing prior advance reference in contract',
    'FINAL_PRIOR_ADVANCE_MISSING',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: {
        ...contract.fixtureContext,
        hasPreviousAdvanceInvoiceId: false,
      },
    }),
  ),
  contractReject(
    'final-022',
    'FINAL',
    'Reject non-synthetic buyer marker in contract',
    'FIXTURE_SYNTHETIC_BUYER_MISSING',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasSyntheticBuyer: false },
    }),
  ),
  contractReject(
    'final-023',
    'FINAL',
    'Reject missing product lines in contract',
    'FIXTURE_PRODUCTS_MISSING',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      fixtureContext: { ...contract.fixtureContext, hasProducts: false },
    }),
  ),
  contractReject(
    'final-024',
    'FINAL',
    'Reject invalid trigger source',
    'TRIGGER_SOURCE_INVALID',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      trigger: {
        ...contract.trigger,
        trigger_source: 'MANUAL_RETRY' as 'BITRIX24_STAGE_CHANGE',
      },
    }),
  ),
  contractReject(
    'final-025',
    'FINAL',
    'Reject non-dry-run contract mode',
    'MODE_INVALID',
    FINAL_BASE,
    (contract) => ({ ...contract, mode: 'LIVE' as 'DRY_RUN' }),
  ),
  contractReject(
    'final-026',
    'FINAL',
    'Reject execution policy allowing backend endpoint',
    'EXECUTION_POLICY_INVALID',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: { ...contract.executionPolicy, backendEndpointAllowed: true as false },
    }),
  ),
  contractReject(
    'final-027',
    'FINAL',
    'Reject execution policy allowing use case execution',
    'EXECUTION_POLICY_INVALID',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: {
        ...contract.executionPolicy,
        useCaseExecutionAllowed: true as false,
      },
    }),
  ),
  contractReject(
    'final-028',
    'FINAL',
    'Reject execution policy allowing DB writes',
    'EXECUTION_POLICY_INVALID',
    FINAL_BASE,
    (contract) => ({
      ...contract,
      executionPolicy: { ...contract.executionPolicy, dbWriteAllowed: true as false },
    }),
  ),
  adapterReject(
    'final-029',
    'FINAL',
    'Adapter rejects missing prior advance references',
    B.finalMissingPriorAdvance(),
  ),
  adapterReject('final-030', 'FINAL', 'Adapter rejects scenarioType mismatch in context', {
    ...FINAL_BASE,
    scenarioType: 'FULL' as 'FINAL',
  }),
  adapterReject('final-031', 'FINAL', 'Adapter rejects deal id without [TEST] prefix', {
    ...FINAL_BASE,
    bitrixDealId: 'PROD-FINAL-002',
  }),
  adapterReject('final-032', 'FINAL', 'Adapter rejects invoiceType mismatch in context', {
    ...FINAL_BASE,
    invoiceType: 'FULL' as 'FINAL',
  }),
  adapterReject('final-033', 'FINAL', 'Adapter rejects empty bitrix deal id', {
    ...FINAL_BASE,
    bitrixDealId: '',
  }),
  adapterReject('final-034', 'FINAL', 'Adapter rejects ADVANCE scenarioType on FINAL fixture', {
    ...FINAL_BASE,
    scenarioType: 'ADVANCE' as 'FINAL',
    invoiceType: 'ADVANCE' as 'FINAL',
  }),
  adapterReject('final-035', 'FINAL', 'Adapter rejects empty prior advance references', B.finalMissingPriorAdvance()),
  backendReject(
    'final-036',
    'FINAL',
    'Backend blocks FINAL without previous advance invoice',
    ['MISSING_PREVIOUS_ADVANCE_INVOICE'],
  ),
  backendReject(
    'final-037',
    'FINAL',
    'Backend blocks unresolved invoice type on FINAL deal',
    ['MISSING_INVOICE_TYPE'],
  ),
  backendReject('final-038', 'FINAL', 'Backend blocks buyer without NIP', ['MISSING_NIP']),
  backendReject(
    'final-039',
    'FINAL',
    'Backend blocks invoice without products',
    ['MISSING_PRODUCTS'],
  ),
  backendReject(
    'final-040',
    'FINAL',
    'Backend blocks invoice with invalid product line',
    ['INVALID_PRODUCT_LINE'],
  ),
];

export const FULL_INVOICE_RUNNER_MATRIX_CASES = FULL_CASES;
export const ADVANCE_INVOICE_RUNNER_MATRIX_CASES = ADVANCE_CASES;
export const FINAL_INVOICE_RUNNER_MATRIX_CASES = FINAL_CASES;

export const INVOICE_RUNNER_MATRIX_CASES: InvoiceRunnerMatrixCase[] = [
  ...FULL_CASES,
  ...ADVANCE_CASES,
  ...FINAL_CASES,
];

export function assertInvoiceRunnerMatrixCounts(cases: InvoiceRunnerMatrixCase[]): void {
  const counts = {
    FULL: cases.filter((item) => item.invoiceType === 'FULL').length,
    ADVANCE: cases.filter((item) => item.invoiceType === 'ADVANCE').length,
    FINAL: cases.filter((item) => item.invoiceType === 'FINAL').length,
  };

  if (counts.FULL !== 40 || counts.ADVANCE !== 40 || counts.FINAL !== 40) {
    throw new Error(
      `Invoice runner matrix must contain exactly 40 cases per type; got FULL=${counts.FULL}, ADVANCE=${counts.ADVANCE}, FINAL=${counts.FINAL}`,
    );
  }

  if (cases.length !== 120) {
    throw new Error(`Invoice runner matrix must contain exactly 120 cases; got ${cases.length}`);
  }
}

assertInvoiceRunnerMatrixCounts(INVOICE_RUNNER_MATRIX_CASES);

export function summarizeInvoiceRunnerMatrixCases(
  cases: InvoiceRunnerMatrixCase[] = INVOICE_RUNNER_MATRIX_CASES,
): Record<
  InvoiceRunnerMatrixCase['invoiceType'],
  Record<InvoiceRunnerMatrixCase['category'], number>
> {
  return {
    FULL: countByCategory(cases, 'FULL'),
    ADVANCE: countByCategory(cases, 'ADVANCE'),
    FINAL: countByCategory(cases, 'FINAL'),
  };
}

function countByCategory(
  cases: InvoiceRunnerMatrixCase[],
  invoiceType: InvoiceRunnerMatrixCase['invoiceType'],
): Record<InvoiceRunnerMatrixCase['category'], number> {
  const filtered = cases.filter((item) => item.invoiceType === invoiceType);
  return {
    happy_path: filtered.filter((item) => item.category === 'happy_path').length,
    valid_variant: filtered.filter((item) => item.category === 'valid_variant').length,
    contract_guard: filtered.filter((item) => item.category === 'contract_guard').length,
    adapter_guard: filtered.filter((item) => item.category === 'adapter_guard').length,
    backend_validation_guard: filtered.filter(
      (item) => item.category === 'backend_validation_guard',
    ).length,
  };
}
