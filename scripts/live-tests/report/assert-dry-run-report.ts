import { FORBIDDEN_REAL_DATA_MARKERS, hasTestDealPrefix } from '../fixtures/fixture-common';
import {
  liveTestReportSchema,
  type LiveTestReport,
} from '../types/live-test-report.types';
import {
  EXPECTED_DRY_RUN_REPORT_REQUIREMENTS,
  REQUIRED_DRY_RUN_INTEGRATION_STATUSES,
  REQUIRED_DRY_RUN_SCENARIO_STEP_STATUSES,
  type ExpectedDryRunScenarioId,
} from './expected-dry-run-report.shape';
import { isIso8601Timestamp } from './normalize-dry-run-report';

export type DryRunReportAssertionCode =
  | 'SCHEMA_INVALID'
  | 'FORBIDDEN_PRODUCTION_READINESS'
  | 'FORBIDDEN_KSEF_STATUS'
  | 'FORBIDDEN_BITRIX_SYNC_STATUS'
  | 'FORBIDDEN_EXTERNAL_SIDE_EFFECTS'
  | 'FORBIDDEN_INTEGRATION_STATUS'
  | 'FORBIDDEN_SCENARIO_STEP_STATUS'
  | 'FORBIDDEN_REAL_DATA'
  | 'FORBIDDEN_CREATION_CLAIM'
  | 'SCENARIO_TYPE_MISMATCH'
  | 'FIXTURE_MISMATCH'
  | 'MISSING_TEST_DEAL_PREFIX'
  | 'INVALID_TIMESTAMP'
  | 'MARKDOWN_FORBIDDEN_CONTENT'
  | 'MARKDOWN_MISSING_CONTENT';

export class DryRunReportAssertionError extends Error {
  readonly code: DryRunReportAssertionCode;

  constructor(code: DryRunReportAssertionCode, message: string) {
    super(message);
    this.name = 'DryRunReportAssertionError';
    this.code = code;
  }
}

const ALLOWED_KSEF_STATUSES = new Set(['MANUAL_REQUIRED']);
const ALLOWED_BITRIX_SYNC_STATUSES = new Set(['NOT_TESTED_YET']);
const FORBIDDEN_EXECUTED_INTEGRATION_STATUSES = new Set([
  'PASSED',
  'FAILED',
]);
const FORBIDDEN_CREATION_CLAIMS = [
  /invoice was created/i,
  /order was created/i,
  /deal was created/i,
  /created in bitrix/i,
  /created in fakturownia/i,
];

const REQUIRED_MARKDOWN_SNIPPETS = [
  'DRY_RUN',
  'NOT_READY',
  'MANUAL_REQUIRED',
  'NOT_TESTED_YET',
  'External side effects executed: **false**',
  '## Backend dry-run contract',
  'Contract validation: **PASSED**',
  'Backend endpoint allowed: **false**',
  '## Backend availability smoke',
  'BACKEND_AVAILABILITY',
  'External side effects executed: **false**',
  'Workflow executed: **false**',
  '## Backend smoke-readiness',
  'BACKEND_SMOKE_READINESS',
  'Endpoint called: **false**',
  'Auth secret displayed: **false**',
  '## Backend trigger preflight',
  'BACKEND_TRIGGER_PREFLIGHT',
  'Trigger execution allowed: **false**',
  'Request sent: **false**',
  '## Backend dry-run',
  'BACKEND_DRY_RUN_SIMULATED',
  'Real backend workflow ran: **false**',
  'DB write executed: **false**',
  '## Fixture summary',
  'SKIPPED_NOT_EXECUTED',
] as const;

const FORBIDDEN_MARKDOWN_SNIPPETS = [
  '- Status: **READY**',
  'External side effects executed: **true**',
  'invoice was created',
  'order was created',
  'deal was created',
  'Bitrix24 executed',
  'Fakturownia executed',
  'Real backend workflow ran: **true**',
] as const;

function assertNoForbiddenMarkersInText(
  text: string,
  code: DryRunReportAssertionCode,
): void {
  for (const pattern of FORBIDDEN_REAL_DATA_MARKERS) {
    if (pattern.test(text)) {
      throw new DryRunReportAssertionError(
        code,
        `Report contains forbidden real-data marker matching ${pattern}`,
      );
    }
  }

  for (const pattern of FORBIDDEN_CREATION_CLAIMS) {
    if (pattern.test(text)) {
      throw new DryRunReportAssertionError(
        code,
        `Report contains forbidden creation claim matching ${pattern}`,
      );
    }
  }
}

export function assertForbiddenDryRunReportStates(report: LiveTestReport): void {
  if (report.productionReadiness !== 'NOT_READY') {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_PRODUCTION_READINESS',
      `productionReadiness must be NOT_READY, got ${report.productionReadiness}`,
    );
  }

  if (report.externalSideEffectsExecuted !== false) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'externalSideEffectsExecuted must be false in dry-run',
    );
  }

  if (
    !ALLOWED_KSEF_STATUSES.has(report.ksefStatus) ||
    !ALLOWED_KSEF_STATUSES.has(report.integrations.ksef)
  ) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_KSEF_STATUS',
      `KSeF must be MANUAL_REQUIRED in dry-run (${report.ksefStatus})`,
    );
  }

  if (
    !ALLOWED_BITRIX_SYNC_STATUSES.has(report.bitrixSyncStatus) ||
    !ALLOWED_BITRIX_SYNC_STATUSES.has(report.integrations.bitrixSync)
  ) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_BITRIX_SYNC_STATUS',
      `Bitrix sync must be NOT_TESTED_YET in dry-run (${report.bitrixSyncStatus})`,
    );
  }

  const executedIntegrations: Array<keyof LiveTestReport['integrations']> = [
    'bitrixDealSetup',
    'backendWorkflow',
    'fakturowniaOrder',
    'fakturowniaInvoice',
  ];

  for (const key of executedIntegrations) {
    const status = report.integrations[key];
    if (FORBIDDEN_EXECUTED_INTEGRATION_STATUSES.has(status)) {
      throw new DryRunReportAssertionError(
        'FORBIDDEN_INTEGRATION_STATUS',
        `Integration ${key} must not be executed in dry-run (${status})`,
      );
    }
  }

  assertNoForbiddenMarkersInText(JSON.stringify(report), 'FORBIDDEN_REAL_DATA');
  assertNoForbiddenMarkersInText(report.summary, 'FORBIDDEN_CREATION_CLAIM');
}

function assertTimestamps(report: LiveTestReport): void {
  if (!isIso8601Timestamp(report.meta.startedAt)) {
    throw new DryRunReportAssertionError(
      'INVALID_TIMESTAMP',
      `startedAt is not a valid ISO timestamp: ${report.meta.startedAt}`,
    );
  }

  if (!isIso8601Timestamp(report.meta.finishedAt)) {
    throw new DryRunReportAssertionError(
      'INVALID_TIMESTAMP',
      `finishedAt is not a valid ISO timestamp: ${report.meta.finishedAt}`,
    );
  }
}

export function assertDryRunScenarioRequirements(
  report: LiveTestReport,
  scenarioId: ExpectedDryRunScenarioId,
): void {
  const expected = EXPECTED_DRY_RUN_REPORT_REQUIREMENTS[scenarioId];

  if (report.mode !== 'DRY_RUN') {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      `mode must be DRY_RUN, got ${report.mode}`,
    );
  }

  if (report.meta.scenarioId !== expected.scenarioId) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      `scenarioId must be ${expected.scenarioId}`,
    );
  }

  if (report.fixture.scenarioType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      `fixture.scenarioType must be ${expected.scenarioType}`,
    );
  }

  if (report.fixture.expectedInvoiceType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      'fixture.expectedInvoiceType must match scenarioType',
    );
  }

  if (report.scenario.status !== 'DRY_RUN_COMPLETED') {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      `scenario.status must be DRY_RUN_COMPLETED, got ${report.scenario.status}`,
    );
  }

  if (!hasTestDealPrefix(report.fixture.bitrixDealId)) {
    throw new DryRunReportAssertionError(
      'MISSING_TEST_DEAL_PREFIX',
      `bitrixDealId must start with [TEST], got ${report.fixture.bitrixDealId}`,
    );
  }

  if (report.fixture.testContextId !== expected.testContextId) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      `fixture.testContextId must be ${expected.testContextId}`,
    );
  }

  if (report.fixture.bitrixDealId !== expected.bitrixDealId) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      `fixture.bitrixDealId must be ${expected.bitrixDealId}`,
    );
  }

  if (report.fixture.paidStageId !== expected.paidStageId) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      `fixture.paidStageId must be ${expected.paidStageId}`,
    );
  }

  if (report.fixture.productSummary.length !== expected.productCount) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      `fixture.productSummary length must be ${expected.productCount}`,
    );
  }

  if (expected.requiresAdvanceAmount && !report.fixture.advanceAmountPln) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'ADVANCE report must include fixture.advanceAmountPln',
    );
  }

  if (!expected.requiresAdvanceAmount && report.fixture.advanceAmountPln) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'FULL/FINAL report must not include fixture.advanceAmountPln',
    );
  }

  if (
    expected.requiresPreviousAdvanceInvoiceId &&
    !report.fixture.previousAdvanceInvoiceId
  ) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'FINAL report must include fixture.previousAdvanceInvoiceId',
    );
  }

  if (
    !expected.requiresPreviousAdvanceInvoiceId &&
    report.fixture.previousAdvanceInvoiceId
  ) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'FULL/ADVANCE report must not include fixture.previousAdvanceInvoiceId',
    );
  }

  if (report.safety.checks.length === 0) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'safety.checks must not be empty',
    );
  }

  if (!report.fixture.buyerSummary.companyName.includes('[TEST]')) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'buyerSummary must use synthetic [TEST] company name',
    );
  }

  if (!report.fixture.buyerSummary.nipMasked.startsWith('TEST-')) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'buyerSummary.nipMasked must be masked test NIP',
    );
  }
}

function assertIntegrationStatuses(report: LiveTestReport): void {
  for (const [key, expectedStatus] of Object.entries(
    REQUIRED_DRY_RUN_INTEGRATION_STATUSES,
  )) {
    const actual =
      report.integrations[key as keyof typeof REQUIRED_DRY_RUN_INTEGRATION_STATUSES];
    if (actual !== expectedStatus) {
      throw new DryRunReportAssertionError(
        'FORBIDDEN_INTEGRATION_STATUS',
        `integrations.${key} must be ${expectedStatus}, got ${actual}`,
      );
    }
  }
}

function assertScenarioStepStatuses(report: LiveTestReport): void {
  const actualSteps: Record<string, string> = {};
  for (const step of report.scenario.steps) {
    actualSteps[step.name] = step.status;
  }

  for (const [stepName, expectedStatus] of Object.entries(
    REQUIRED_DRY_RUN_SCENARIO_STEP_STATUSES,
  )) {
    if (actualSteps[stepName] !== expectedStatus) {
      throw new DryRunReportAssertionError(
        'FORBIDDEN_SCENARIO_STEP_STATUS',
        `scenario step ${stepName} must be ${expectedStatus}, got ${actualSteps[stepName] ?? 'missing'}`,
      );
    }
  }
}

function assertBackendContractSection(
  report: LiveTestReport,
  scenarioId: ExpectedDryRunScenarioId,
): void {
  const expected = EXPECTED_DRY_RUN_REPORT_REQUIREMENTS[scenarioId];
  const contract = report.backendContract;

  if (contract.mode !== 'DRY_RUN') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendContract.mode must be DRY_RUN',
    );
  }

  if (contract.contractValidationStatus !== 'PASSED') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendContract.contractValidationStatus must be PASSED',
    );
  }

  if (contract.scenarioType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      'backendContract.scenarioType must match scenario',
    );
  }

  if (contract.expectedInvoiceType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      'backendContract.expectedInvoiceType must match scenario',
    );
  }

  if (contract.trigger.bitrix_deal_id !== expected.bitrixDealId) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendContract.trigger.bitrix_deal_id must match fixture',
    );
  }

  if (contract.trigger.trigger_source !== 'BITRIX24_STAGE_CHANGE') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendContract.trigger.trigger_source must be BITRIX24_STAGE_CHANGE',
    );
  }

  if (!contract.trigger.trigger_stage_id.trim()) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendContract.trigger.trigger_stage_id is required',
    );
  }

  if (!isIso8601Timestamp(contract.trigger.triggered_at)) {
    throw new DryRunReportAssertionError(
      'INVALID_TIMESTAMP',
      'backendContract.trigger.triggered_at must be ISO-8601',
    );
  }

  const policy = contract.executionPolicy;
  if (
    policy.backendEndpointAllowed !== false ||
    policy.useCaseExecutionAllowed !== false ||
    policy.dbWriteAllowed !== false ||
    policy.externalSideEffectsAllowed !== false
  ) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backendContract.executionPolicy must deny all execution',
    );
  }
}

function assertBackendAvailabilitySmokeSection(report: LiveTestReport): void {
  const availability = report.backendAvailabilitySmoke;

  if (availability.mode !== 'CONTROLLED_BACKEND_SMOKE') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendAvailabilitySmoke.mode must be CONTROLLED_BACKEND_SMOKE',
    );
  }

  if (availability.smokeKind !== 'BACKEND_AVAILABILITY') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendAvailabilitySmoke.smokeKind must be BACKEND_AVAILABILITY',
    );
  }

  if (availability.target.method !== 'GET') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendAvailabilitySmoke.target.method must be GET',
    );
  }

  if (availability.target.path !== '/health') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendAvailabilitySmoke.target.path must be /health',
    );
  }

  const safetyFlags = [
    availability.externalSideEffectsExecuted,
    availability.workflowExecuted,
    availability.invoiceProcessCreated,
    availability.invoiceRecordCreated,
    availability.dbWriteExecuted,
    availability.bitrixCalled,
    availability.fakturowniaCalled,
    availability.ksefTested,
  ];

  if (safetyFlags.some((flag) => flag !== false)) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backendAvailabilitySmoke safety flags must remain false',
    );
  }

  if (
    availability.resultStatus === 'BACKEND_HEALTH_NOT_CONFIGURED' &&
    availability.target.endpointCalled
  ) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'NOT_CONFIGURED availability smoke must not call backend',
    );
  }

  const serialized = JSON.stringify(report);
  const secret = process.env.LIVE_TEST_BACKEND_AUTH_SECRET?.trim();
  if (secret && secret.length >= 8 && serialized.includes(secret)) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'Report must not contain backend auth secret values',
    );
  }
}

function assertBackendSmokeReadinessSection(
  report: LiveTestReport,
  scenarioId: ExpectedDryRunScenarioId,
): void {
  const expected = EXPECTED_DRY_RUN_REPORT_REQUIREMENTS[scenarioId];
  const smoke = report.backendSmokeReadiness;

  if (smoke.mode !== 'DRY_RUN') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendSmokeReadiness.mode must be DRY_RUN',
    );
  }

  if (smoke.readinessKind !== 'BACKEND_SMOKE_READINESS') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendSmokeReadiness.readinessKind must be BACKEND_SMOKE_READINESS',
    );
  }

  if (smoke.scenarioType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      'backendSmokeReadiness.scenarioType must match scenario',
    );
  }

  if (smoke.target.method !== 'POST') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendSmokeReadiness.target.method must be POST',
    );
  }

  if (smoke.target.path !== '/invoice-processes/bitrix-trigger') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendSmokeReadiness.target.path must be /invoice-processes/bitrix-trigger',
    );
  }

  if (smoke.target.endpointCallAllowed !== false || smoke.target.endpointCalled !== false) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backend smoke target must not allow or record endpoint calls',
    );
  }

  if (smoke.auth.secretDisplayed !== false) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backendSmokeReadiness.auth.secretDisplayed must be false',
    );
  }

  const policy = smoke.executionPolicy;
  if (
    policy.backendEndpointAllowed !== false ||
    policy.useCaseExecutionAllowed !== false ||
    policy.dbWriteAllowed !== false ||
    policy.externalSideEffectsAllowed !== false
  ) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backendSmokeReadiness.executionPolicy must deny all execution',
    );
  }

  if (
    smoke.readinessStatus === 'NOT_READY_FOR_BACKEND_SMOKE' &&
    smoke.blockers.length === 0
  ) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'NOT_READY smoke readiness must include blockers',
    );
  }

  const serialized = JSON.stringify(report);
  if (configLooksLikeSecretLeak(serialized)) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'Report must not contain raw backend auth secret values',
    );
  }
}

function configLooksLikeSecretLeak(serializedReport: string): boolean {
  const secret = process.env.LIVE_TEST_BACKEND_AUTH_SECRET?.trim();
  if (!secret || secret.length < 8) {
    return false;
  }

  return serializedReport.includes(secret);
}

function assertBackendTriggerPreflightSection(
  report: LiveTestReport,
  scenarioId: ExpectedDryRunScenarioId,
): void {
  const expected = EXPECTED_DRY_RUN_REPORT_REQUIREMENTS[scenarioId];
  const preflight = report.backendTriggerPreflight;

  if (preflight.mode !== 'CONTROLLED_BACKEND_PREFLIGHT') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendTriggerPreflight.mode must be CONTROLLED_BACKEND_PREFLIGHT',
    );
  }

  if (preflight.preflightKind !== 'BACKEND_TRIGGER_PREFLIGHT') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendTriggerPreflight.preflightKind must be BACKEND_TRIGGER_PREFLIGHT',
    );
  }

  if (preflight.target.method !== 'POST') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendTriggerPreflight.target.method must be POST',
    );
  }

  if (preflight.target.path !== '/invoice-processes/bitrix-trigger') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendTriggerPreflight.target.path must be /invoice-processes/bitrix-trigger',
    );
  }

  if (preflight.scenarioType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      'backendTriggerPreflight.scenarioType must match scenario',
    );
  }

  if (!hasTestDealPrefix(preflight.request.bitrix_deal_id)) {
    throw new DryRunReportAssertionError(
      'MISSING_TEST_DEAL_PREFIX',
      'backendTriggerPreflight.request.bitrix_deal_id must start with [TEST]',
    );
  }

  if (preflight.request.trigger_source !== 'BITRIX24_STAGE_CHANGE') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendTriggerPreflight.request.trigger_source must be BITRIX24_STAGE_CHANGE',
    );
  }

  if (!preflight.request.trigger_stage_id.trim()) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendTriggerPreflight.request.trigger_stage_id is required',
    );
  }

  if (!isIso8601Timestamp(preflight.request.triggered_at)) {
    throw new DryRunReportAssertionError(
      'INVALID_TIMESTAMP',
      'backendTriggerPreflight.request.triggered_at must be ISO-8601',
    );
  }

  const policy = preflight.executionPolicy;
  if (
    policy.triggerExecutionAllowed !== false ||
    policy.backendEndpointAllowed !== false ||
    policy.useCaseExecutionAllowed !== false ||
    policy.dbWriteAllowed !== false ||
    policy.externalSideEffectsAllowed !== false
  ) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backendTriggerPreflight.executionPolicy must deny all execution',
    );
  }

  const execution = preflight.execution;
  const executionFlags = [
    execution.requestSent,
    execution.endpointCalled,
    execution.workflowExecuted,
    execution.dbWriteExecuted,
    execution.bitrixCalled,
    execution.fakturowniaCalled,
    execution.ksefTested,
  ];

  if (executionFlags.some((flag) => flag !== false)) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backendTriggerPreflight.execution flags must remain false',
    );
  }

  if (preflight.target.secretDisplayed !== false) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'backendTriggerPreflight.target.secretDisplayed must be false',
    );
  }

  const serialized = JSON.stringify(report);
  const secret = process.env.LIVE_TEST_BACKEND_AUTH_SECRET?.trim();
  if (secret && secret.length >= 8 && serialized.includes(secret)) {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
      'Report must not contain backend auth secret values',
    );
  }
}

function assertBackendDryRunSection(
  report: LiveTestReport,
  scenarioId: ExpectedDryRunScenarioId,
): void {
  const expected = EXPECTED_DRY_RUN_REPORT_REQUIREMENTS[scenarioId];
  const backend = report.backendDryRun;

  if (backend.backendMode !== 'DRY_RUN') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendDryRun.backendMode must be DRY_RUN',
    );
  }

  if (backend.resultStatus !== 'BACKEND_DRY_RUN_SIMULATED') {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendDryRun.resultStatus must be BACKEND_DRY_RUN_SIMULATED',
    );
  }

  if (backend.scenarioType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      'backendDryRun.scenarioType must match scenario',
    );
  }

  if (backend.expectedInvoiceType !== expected.scenarioType) {
    throw new DryRunReportAssertionError(
      'SCENARIO_TYPE_MISMATCH',
      'backendDryRun.expectedInvoiceType must match scenario',
    );
  }

  if (backend.bitrixDealId !== expected.bitrixDealId) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendDryRun.bitrixDealId must match fixture',
    );
  }

  const mustBeFalse: Array<keyof typeof backend> = [
    'backendWorkflowExecuted',
    'backendEndpointCalled',
    'useCaseExecuted',
    'invoiceProcessCreated',
    'invoiceRecordCreated',
    'invoiceEventCreated',
    'dbWriteExecuted',
  ];

  for (const field of mustBeFalse) {
    if (backend[field] !== false) {
      throw new DryRunReportAssertionError(
        'FORBIDDEN_EXTERNAL_SIDE_EFFECTS',
        `backendDryRun.${field} must be false`,
      );
    }
  }

  if (!backend.validationSimulated || !backend.mappedFromFixture) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendDryRun must indicate validationSimulated and mappedFromFixture',
    );
  }

  if (backend.notes.length === 0) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'backendDryRun.notes must document that no real workflow ran',
    );
  }
}

function assertCommonSafetyFields(report: LiveTestReport): void {
  if (report.ksefStatus !== 'MANUAL_REQUIRED') {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_KSEF_STATUS',
      `ksefStatus must be MANUAL_REQUIRED, got ${report.ksefStatus}`,
    );
  }

  if (report.bitrixSyncStatus !== 'NOT_TESTED_YET') {
    throw new DryRunReportAssertionError(
      'FORBIDDEN_BITRIX_SYNC_STATUS',
      `bitrixSyncStatus must be NOT_TESTED_YET, got ${report.bitrixSyncStatus}`,
    );
  }

  if (!report.safety.passed) {
    throw new DryRunReportAssertionError(
      'FIXTURE_MISMATCH',
      'safety.passed must be true for dry-run placeholder scenarios',
    );
  }
}

export function parseDryRunReport(input: unknown): LiveTestReport {
  const result = liveTestReportSchema.safeParse(input);

  if (!result.success) {
    throw new DryRunReportAssertionError(
      'SCHEMA_INVALID',
      `Report schema validation failed: ${result.error.message}`,
    );
  }

  return result.data;
}

export function assertDryRunReport(
  report: LiveTestReport,
  scenarioId: ExpectedDryRunScenarioId,
): void {
  assertForbiddenDryRunReportStates(report);
  assertTimestamps(report);
  assertCommonSafetyFields(report);
  assertDryRunScenarioRequirements(report, scenarioId);
  assertBackendContractSection(report, scenarioId);
  assertBackendAvailabilitySmokeSection(report);
  assertBackendSmokeReadinessSection(report, scenarioId);
  assertBackendTriggerPreflightSection(report, scenarioId);
  assertBackendDryRunSection(report, scenarioId);
  assertIntegrationStatuses(report);
  assertScenarioStepStatuses(report);
}

export function assertDryRunMarkdown(
  markdown: string,
  scenarioId: ExpectedDryRunScenarioId,
): void {
  const expected = EXPECTED_DRY_RUN_REPORT_REQUIREMENTS[scenarioId];

  for (const snippet of REQUIRED_MARKDOWN_SNIPPETS) {
    if (!markdown.includes(snippet)) {
      throw new DryRunReportAssertionError(
        'MARKDOWN_MISSING_CONTENT',
        `Markdown report must include: ${snippet}`,
      );
    }
  }

  if (!markdown.includes(`**Scenario:** ${expected.scenarioId}`)) {
    throw new DryRunReportAssertionError(
      'MARKDOWN_MISSING_CONTENT',
      `Markdown must include scenario name ${expected.scenarioId}`,
    );
  }

  if (!markdown.includes(expected.bitrixDealId)) {
    throw new DryRunReportAssertionError(
      'MARKDOWN_MISSING_CONTENT',
      `Markdown must include deal id ${expected.bitrixDealId}`,
    );
  }

  for (const snippet of FORBIDDEN_MARKDOWN_SNIPPETS) {
    if (markdown.toLowerCase().includes(snippet.toLowerCase())) {
      throw new DryRunReportAssertionError(
        'MARKDOWN_FORBIDDEN_CONTENT',
        `Markdown report must not include: ${snippet}`,
      );
    }
  }

  assertNoForbiddenMarkersInText(markdown, 'FORBIDDEN_REAL_DATA');
}