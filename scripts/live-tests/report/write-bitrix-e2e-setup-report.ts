import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { BitrixE2eSetupReport } from '../types/bitrix-e2e-setup-report.types';

export interface WriteBitrixE2eSetupReportOptions {
  outputDir: string;
  timestamp?: Date;
}

export interface WriteBitrixE2eSetupReportResult {
  jsonPath: string;
  markdownPath: string;
}

function formatReportTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function buildBitrixE2eSetupReportMarkdown(report: BitrixE2eSetupReport): string {
  const safetyRows = report.safety.checks
    .map((check) => `| ${check.code} | ${check.status} | ${check.message} |`)
    .join('\n');

  const setup = report.bitrixE2eSetup;

  return [
    '# Bitrix E2E Setup Report',
    '',
    `**Scenario:** ${report.meta.scenarioId} (${report.meta.invoiceType})`,
    `**Mode:** ${report.mode}`,
    `**Trigger mode:** ${report.triggerMode}`,
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
    `- Manual verification required: **${report.manualVerificationRequired}**`,
    `- Runner direct backend trigger: **${report.runnerDirectBackendTrigger}**`,
    `- Backend trigger request sent: **${report.backendTriggerRequestSent}**`,
    '',
    '## Bitrix E2E setup',
    '',
    `- Result: **${setup.resultStatus}**`,
    `- Deal created: **${setup.bitrixDealCreated}**`,
    `- Deal updated: **${setup.bitrixDealUpdated}**`,
    `- Stage changed: **${setup.bitrixStageChanged}**`,
    `- Bitrix deal id: **${setup.bitrixDealId ?? 'n/a'}**`,
    `- Deal title: **${setup.dealTitle}**`,
    `- Paid stage id: **${setup.paidStageId}**`,
    `- Webhook configured: **${setup.webhookConfigured}**`,
    setup.webhookMasked ? `- Webhook (masked): **${setup.webhookMasked}**` : '',
    '',
    '## Automation expectations',
    '',
    `- Bitrix automation expected: **${setup.bitrixAutomationExpected}**`,
    `- n8n trigger expected: **${setup.n8nTriggerExpected}**`,
    `- Backend workflow may have executed: **${setup.backendWorkflowMayHaveExecuted}**`,
    `- Backend side effects may have occurred: **${setup.backendSideEffectsMayHaveOccurred}**`,
    '',
    '## Runner direct side effects',
    '',
    `- Runner direct Bitrix call: **${report.runnerDirectSideEffects.runnerDirectBitrixCall}**`,
    `- Runner direct Fakturownia call: **${report.runnerDirectSideEffects.runnerDirectFakturowniaCall}**`,
    `- Runner direct DB write: **${report.runnerDirectSideEffects.runnerDirectDbWrite}**`,
    `- Runner direct external side effects executed: **${report.runnerDirectExternalSideEffectsExecuted}**`,
    '',
    '## Safety checks',
    '',
    '| Code | Status | Message |',
    '| --- | --- | --- |',
    safetyRows,
    '',
    setup.gate.blockers.length > 0
      ? `### Gate blockers\n\n${setup.gate.blockers.map((b) => `- ${b}`).join('\n')}`
      : '',
    setup.errors.length > 0
      ? `### Errors\n\n${setup.errors.map((e) => `- ${e}`).join('\n')}`
      : '',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

export async function writeBitrixE2eSetupReport(
  report: BitrixE2eSetupReport,
  options: WriteBitrixE2eSetupReportOptions,
): Promise<WriteBitrixE2eSetupReportResult> {
  const timestamp = options.timestamp ?? new Date();
  const stamp = formatReportTimestamp(timestamp);
  const baseName = `bitrix-e2e-full-${stamp}`;
  const outputDir = options.outputDir;

  await mkdir(outputDir, { recursive: true });

  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, `${buildBitrixE2eSetupReportMarkdown(report)}\n`, 'utf8');

  return { jsonPath, markdownPath };
}
