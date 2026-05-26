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
    `- External side effects executed: **${report.externalSideEffectsExecuted}**`,
    `- KSeF status: **${report.ksefStatus}**`,
    `- Bitrix sync status: **${report.bitrixSyncStatus}**`,
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
