import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { LiveTestReport } from '../types/live-test-report.types';

export interface WriteLiveTestReportOptions {
  outputDir: string;
  timestamp?: Date;
}

export interface WriteLiveTestReportResult {
  jsonPath: string;
  markdownPath: string;
}

function formatReportTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function buildLiveTestReportMarkdown(report: LiveTestReport): string {
  const safetyRows = report.safety.checks
    .map(
      (check) =>
        `| ${check.code} | ${check.status} | ${check.message} |`,
    )
    .join('\n');

  const stepRows = report.scenario.steps
    .map(
      (step) =>
        `| ${step.name} | ${step.status} | ${step.message ?? ''} |`,
    )
    .join('\n');

  const productRows = report.fixture.productSummary
    .map(
      (line) =>
        `| ${line.name} | ${line.quantity} | ${line.unitPricePln} PLN |`,
    )
    .join('\n');

  const skippedSteps = report.fixture.expectedExternalStepsSkipped
    .map((step) => `- ${step}`)
    .join('\n');

  const backendNotes = report.backendDryRun.notes.map((note) => `- ${note}`).join('\n');

  return [
    '# Live Test Report',
    '',
    `**Scenario:** ${report.meta.scenarioId} (${report.meta.invoiceType})`,
    `**Mode:** ${report.mode}`,
    `**Runner:** ${report.meta.runnerVersion}`,
    `**Started:** ${report.meta.startedAt}`,
    `**Finished:** ${report.meta.finishedAt}`,
    '',
    '## Summary',
    '',
    report.summary,
    '',
    '## Production readiness',
    '',
    `- Status: **${report.productionReadiness}**`,
    `- Runner direct external side effects executed: **${report.runnerDirectExternalSideEffectsExecuted}**`,
    `- Manual verification required: **${report.manualVerificationRequired}**`,
    `- KSeF status: **${report.ksefStatus}**`,
    `- Bitrix sync status: **${report.bitrixSyncStatus}**`,
    '',
    '## Runner direct side effects',
    '',
    `- Runner direct Bitrix call: **${report.runnerDirectSideEffects.runnerDirectBitrixCall}**`,
    `- Runner direct Fakturownia call: **${report.runnerDirectSideEffects.runnerDirectFakturowniaCall}**`,
    `- Runner direct DB write: **${report.runnerDirectSideEffects.runnerDirectDbWrite}**`,
    `- Runner direct KSeF call: **${report.runnerDirectSideEffects.runnerDirectKsefCall}**`,
    `- Runner direct external side effects executed: **${report.runnerDirectSideEffects.runnerDirectExternalSideEffectsExecuted}**`,
    '',
    '## Backend trigger execution',
    '',
    `- Mode: **${report.backendTriggerExecution.mode}**`,
    `- Execution kind: **${report.backendTriggerExecution.executionKind}**`,
    `- Result status: **${report.backendTriggerExecution.resultStatus}**`,
    `- Gate execution allowed: **${report.backendTriggerExecution.gate.executionAllowed}**`,
    `- Trigger execution allowed: **${report.backendTriggerExecution.gate.triggerExecutionAllowed}**`,
    `- Target: **${report.backendTriggerExecution.target.method} ${report.backendTriggerExecution.target.path}**`,
    `- Auth secret displayed: **${report.backendTriggerExecution.target.secretDisplayed}**`,
    `- Trigger payload deal ID (bitrix_deal_id): **${report.backendTriggerExecution.request.payload.bitrix_deal_id}**`,
    `- Trigger source: **${report.backendTriggerExecution.request.payload.trigger_source}**`,
    `- Trigger stage ID: **${report.backendTriggerExecution.request.payload.trigger_stage_id}**`,
    `- Triggered at: **${report.backendTriggerExecution.request.payload.triggered_at}**`,
    `- Backend trigger request sent: **${report.backendTriggerExecution.systemEffects.backendTriggerRequestSent}**`,
    `- Backend endpoint called: **${report.backendTriggerExecution.systemEffects.backendEndpointCalled}**`,
    `- Backend workflow execution attempted: **${report.backendTriggerExecution.systemEffects.backendWorkflowExecutionAttempted}**`,
    `- Backend workflow may have executed: **${report.backendTriggerExecution.systemEffects.backendWorkflowMayHaveExecuted}**`,
    `- Backend side effects may have occurred: **${report.backendTriggerExecution.systemEffects.backendSideEffectsMayHaveOccurred}**`,
    `- DB write may have occurred (backend): **${report.backendTriggerExecution.systemEffects.dbWriteMayHaveOccurred}**`,
    `- Bitrix may have been called (backend): **${report.backendTriggerExecution.systemEffects.bitrixMayHaveBeenCalled}**`,
    `- Fakturownia may have been called (backend): **${report.backendTriggerExecution.systemEffects.fakturowniaMayHaveBeenCalled}**`,
    `- Invoice may have been created: **${report.backendTriggerExecution.systemEffects.invoiceMayHaveBeenCreated}**`,
    `- KSeF may have been handled by Fakturownia: **${report.backendTriggerExecution.systemEffects.ksefMayHaveBeenHandledByFakturownia}**`,
    report.backendTriggerExecution.response
      ? `- HTTP status: **${report.backendTriggerExecution.response.statusCode}**`
      : '',
    ...(report.backendTriggerExecution.gate.blockers.length > 0
      ? [
          '### Trigger execution blockers',
          '',
          ...report.backendTriggerExecution.gate.blockers.map((item) => `- ${item}`),
          '',
        ]
      : []),
    ...(report.backendTriggerExecution.errors.length > 0
      ? [
          '### Trigger execution errors',
          '',
          ...report.backendTriggerExecution.errors.map((item) => `- ${item}`),
          '',
        ]
      : []),
    '## Backend availability smoke',
    '',
    `- Mode: **${report.backendAvailabilitySmoke.mode}**`,
    `- Smoke kind: **${report.backendAvailabilitySmoke.smokeKind}**`,
    `- Target: **${report.backendAvailabilitySmoke.target.method} ${report.backendAvailabilitySmoke.target.path}**`,
    `- Base URL configured: **${report.backendAvailabilitySmoke.target.baseUrlConfigured}**`,
    `- Endpoint called: **${report.backendAvailabilitySmoke.target.endpointCalled}**`,
    `- Result status: **${report.backendAvailabilitySmoke.resultStatus}**`,
    report.backendAvailabilitySmoke.response
      ? `- HTTP status: **${report.backendAvailabilitySmoke.response.statusCode}**`
      : '',
    `- Workflow executed: **${report.backendAvailabilitySmoke.workflowExecuted}**`,
    `- DB write executed: **${report.backendAvailabilitySmoke.dbWriteExecuted}**`,
    `- Bitrix called: **${report.backendAvailabilitySmoke.bitrixCalled}**`,
    `- Fakturownia called: **${report.backendAvailabilitySmoke.fakturowniaCalled}**`,
    `- KSeF tested: **${report.backendAvailabilitySmoke.ksefTested}**`,
    `- Runner direct external side effects executed: **${report.backendAvailabilitySmoke.runnerDirectExternalSideEffectsExecuted}**`,
    '',
    ...(report.backendAvailabilitySmoke.errors.length > 0
      ? [
          '### Availability errors',
          '',
          ...report.backendAvailabilitySmoke.errors.map((item) => `- ${item}`),
          '',
        ]
      : []),
    '## Backend smoke-readiness',
    '',
    `- Readiness kind: **${report.backendSmokeReadiness.readinessKind}**`,
    `- Scenario type: **${report.backendSmokeReadiness.scenarioType}**`,
    `- Readiness status: **${report.backendSmokeReadiness.readinessStatus}**`,
    `- Target: **${report.backendSmokeReadiness.target.method} ${report.backendSmokeReadiness.target.path}**`,
    `- Base URL configured: **${report.backendSmokeReadiness.target.baseUrlConfigured}**`,
    report.backendSmokeReadiness.target.baseUrlMasked
      ? `- Base URL (masked): **${report.backendSmokeReadiness.target.baseUrlMasked}**`
      : '',
    `- Endpoint call allowed: **${report.backendSmokeReadiness.target.endpointCallAllowed}**`,
    `- Endpoint called: **${report.backendSmokeReadiness.target.endpointCalled}**`,
    `- Auth header configured: **${report.backendSmokeReadiness.auth.headerNameConfigured}**`,
    `- Auth secret configured: **${report.backendSmokeReadiness.auth.secretConfigured}**`,
    `- Auth secret displayed: **${report.backendSmokeReadiness.auth.secretDisplayed}**`,
    `- Contract compatible with BitrixTriggerRequestDto: **${report.backendSmokeReadiness.contract.compatibleWithBitrixTriggerRequestDto}**`,
    `- Contract validation: **${report.backendSmokeReadiness.contract.contractValidationStatus}**`,
    `- Backend endpoint allowed: **${report.backendSmokeReadiness.executionPolicy.backendEndpointAllowed}**`,
    `- Use case execution allowed: **${report.backendSmokeReadiness.executionPolicy.useCaseExecutionAllowed}**`,
    `- DB write allowed: **${report.backendSmokeReadiness.executionPolicy.dbWriteAllowed}**`,
    `- External side effects allowed: **${report.backendSmokeReadiness.executionPolicy.externalSideEffectsAllowed}**`,
    '',
    ...(report.backendSmokeReadiness.blockers.length > 0
      ? [
          '### Blockers',
          '',
          ...report.backendSmokeReadiness.blockers.map((item) => `- ${item}`),
          '',
        ]
      : []),
    ...(report.backendSmokeReadiness.warnings.length > 0
      ? [
          '### Warnings',
          '',
          ...report.backendSmokeReadiness.warnings.map((item) => `- ${item}`),
          '',
        ]
      : []),
    '## Backend trigger preflight',
    '',
    `- Mode: **${report.backendTriggerPreflight.mode}**`,
    `- Preflight kind: **${report.backendTriggerPreflight.preflightKind}**`,
    `- Scenario type: **${report.backendTriggerPreflight.scenarioType}**`,
    `- Target: **${report.backendTriggerPreflight.target.method} ${report.backendTriggerPreflight.target.path}**`,
    `- Base URL configured: **${report.backendTriggerPreflight.target.baseUrlConfigured}**`,
    `- Auth header configured: **${report.backendTriggerPreflight.target.authHeaderNameConfigured}**`,
    `- Auth secret configured: **${report.backendTriggerPreflight.target.authSecretConfigured}**`,
    `- Auth secret displayed: **${report.backendTriggerPreflight.target.secretDisplayed}**`,
    `- Payload shape valid: **${report.backendTriggerPreflight.request.payloadShapeValid}**`,
    `- Actual Bitrix deal ID: **${report.backendTriggerPreflight.liveSmokeTarget.actualBitrixDealId}**`,
    `- Test deal label: **${report.backendTriggerPreflight.liveSmokeTarget.testDealLabel}**`,
    `- Test deal label starts with [TEST]: **${report.backendTriggerPreflight.liveSmokeTarget.testDealLabelStartsWithTestPrefix}**`,
    `- Manual CRM preparation confirmed: **${report.backendTriggerPreflight.liveSmokeTarget.manualCrmPreparationConfirmed}**`,
    `- Expected scenario type: **${report.backendTriggerPreflight.liveSmokeTarget.expectedScenarioType}**`,
    `- Expected trigger stage ID: **${report.backendTriggerPreflight.liveSmokeTarget.expectedTriggerStageId}**`,
    `- Live smoke target valid: **${report.backendTriggerPreflight.liveSmokeTarget.liveSmokeTargetValid}**`,
    `- Live execution ready: **${report.backendTriggerPreflight.liveSmokeTarget.liveExecutionReady}**`,
    `- Trigger payload deal ID (bitrix_deal_id): **${report.backendTriggerPreflight.request.bitrix_deal_id}**`,
    `- Trigger source: **${report.backendTriggerPreflight.request.trigger_source}**`,
    `- Trigger stage ID: **${report.backendTriggerPreflight.request.trigger_stage_id}**`,
    `- Triggered at: **${report.backendTriggerPreflight.request.triggered_at}**`,
    `- Trigger execution allowed: **${report.backendTriggerPreflight.executionPolicy.triggerExecutionAllowed}**`,
    `- Backend endpoint allowed: **${report.backendTriggerPreflight.executionPolicy.backendEndpointAllowed}**`,
    `- Request sent: **${report.backendTriggerPreflight.execution.requestSent}**`,
    `- Endpoint called: **${report.backendTriggerPreflight.execution.endpointCalled}**`,
    `- Workflow executed: **${report.backendTriggerPreflight.execution.workflowExecuted}**`,
    `- DB write executed: **${report.backendTriggerPreflight.execution.dbWriteExecuted}**`,
    `- Bitrix called: **${report.backendTriggerPreflight.execution.bitrixCalled}**`,
    `- Fakturownia called: **${report.backendTriggerPreflight.execution.fakturowniaCalled}**`,
    `- KSeF tested: **${report.backendTriggerPreflight.execution.ksefTested}**`,
    `- Preflight status: **${report.backendTriggerPreflight.preflightStatus}**`,
    '',
    ...(report.backendTriggerPreflight.blockers.length > 0
      ? [
          '### Trigger preflight blockers',
          '',
          ...report.backendTriggerPreflight.blockers.map((item) => `- ${item}`),
          '',
        ]
      : []),
    ...(report.backendTriggerPreflight.warnings.length > 0
      ? [
          '### Trigger preflight warnings',
          '',
          ...report.backendTriggerPreflight.warnings.map((item) => `- ${item}`),
          '',
        ]
      : []),
    '### Manual CRM preparation requirements',
    '',
    ...report.backendTriggerPreflight.liveSmokeTarget.manualCrmPreparationRequirements.map(
      (item) => `- ${item}`,
    ),
    '',
    '## Backend dry-run contract',
    '',
    `- Contract mode: **${report.backendContract.mode}**`,
    `- Scenario type: **${report.backendContract.scenarioType}**`,
    `- Expected invoice type: **${report.backendContract.expectedInvoiceType}**`,
    `- Contract validation: **${report.backendContract.contractValidationStatus}**`,
    `- Trigger deal ID: **${report.backendContract.trigger.bitrix_deal_id}**`,
    `- Trigger source: **${report.backendContract.trigger.trigger_source}**`,
    `- Trigger stage ID: **${report.backendContract.trigger.trigger_stage_id}**`,
    `- Triggered at: **${report.backendContract.trigger.triggered_at}**`,
    `- Backend endpoint allowed: **${report.backendContract.executionPolicy.backendEndpointAllowed}**`,
    `- Use case execution allowed: **${report.backendContract.executionPolicy.useCaseExecutionAllowed}**`,
    `- DB write allowed: **${report.backendContract.executionPolicy.dbWriteAllowed}**`,
    `- External side effects allowed: **${report.backendContract.executionPolicy.externalSideEffectsAllowed}**`,
    '',
    '## Backend dry-run',
    '',
    `- Backend mode: **${report.backendDryRun.backendMode}**`,
    `- Result status: **${report.backendDryRun.resultStatus}**`,
    `- Real backend workflow ran: **${report.backendDryRun.backendWorkflowExecuted}**`,
    `- Backend endpoint called: **${report.backendDryRun.backendEndpointCalled}**`,
    `- Use case executed: **${report.backendDryRun.useCaseExecuted}**`,
    `- InvoiceProcess created: **${report.backendDryRun.invoiceProcessCreated}**`,
    `- InvoiceRecord created: **${report.backendDryRun.invoiceRecordCreated}**`,
    `- InvoiceEvent created: **${report.backendDryRun.invoiceEventCreated}**`,
    `- DB write executed: **${report.backendDryRun.dbWriteExecuted}**`,
    `- Validation simulated: **${report.backendDryRun.validationSimulated}**`,
    `- Mapped from fixture: **${report.backendDryRun.mappedFromFixture}**`,
    '',
    backendNotes,
    '',
    '## Fixture summary',
    '',
    `- Test context: **${report.fixture.testContextId}**`,
    `- Scenario type: **${report.fixture.scenarioType}**`,
    `- Expected invoice type: **${report.fixture.expectedInvoiceType}**`,
    `- Bitrix deal ID: **${report.fixture.bitrixDealId}**`,
    `- Paid stage: **${report.fixture.paidStageId}**`,
    `- Buyer: ${report.fixture.buyerSummary.companyName} (${report.fixture.buyerSummary.city}, ${report.fixture.buyerSummary.country})`,
    `- NIP (masked): ${report.fixture.buyerSummary.nipMasked}`,
    report.fixture.advanceAmountPln
      ? `- Advance amount: **${report.fixture.advanceAmountPln} PLN**`
      : '',
    report.fixture.previousAdvanceInvoiceId
      ? `- Previous advance invoice (simulated): **${report.fixture.previousAdvanceInvoiceId}**`
      : '',
    '',
    '### Products',
    '',
    '| Name | Qty | Unit price |',
    '| --- | --- | --- |',
    productRows,
    '',
    '### Expected external steps skipped',
    '',
    skippedSteps,
    '',
    '## Safety checks',
    '',
    '| Code | Status | Message |',
    '| --- | --- | --- |',
    safetyRows,
    '',
    '## Integrations',
    '',
    `| Area | Status |`,
    `| --- | --- |`,
    `| KSeF | ${report.integrations.ksef} |`,
    `| Bitrix sync | ${report.integrations.bitrixSync} |`,
    `| Bitrix deal setup | ${report.integrations.bitrixDealSetup} |`,
    `| Backend workflow | ${report.integrations.backendWorkflow} |`,
    `| Fakturownia order | ${report.integrations.fakturowniaOrder} |`,
    `| Fakturownia invoice | ${report.integrations.fakturowniaInvoice} |`,
    `| Database | ${report.integrations.database} |`,
    '',
    '## Scenario steps',
    '',
    '| Step | Status | Message |',
    '| --- | --- | --- |',
    stepRows,
    '',
    '## Scenario',
    '',
    `- Status: **${report.scenario.status}**`,
    report.scenario.message ? `- Message: ${report.scenario.message}` : '',
    report.scenario.context
      ? `- Test deal: ${report.scenario.context.testDealTitle} (${report.scenario.context.bitrixDealId})`
      : '',
  ]
    .filter((line) => line !== undefined && line !== '')
    .join('\n');
}

export async function writeLiveTestReport(
  report: LiveTestReport,
  options: WriteLiveTestReportOptions,
): Promise<WriteLiveTestReportResult> {
  const timestamp = options.timestamp ?? new Date();
  const fileStem = `${report.meta.scenarioId}-${formatReportTimestamp(timestamp)}`;
  const jsonPath = join(options.outputDir, `${fileStem}.json`);
  const markdownPath = join(options.outputDir, `${fileStem}.md`);

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, buildLiveTestReportMarkdown(report), 'utf8');

  return { jsonPath, markdownPath };
}
