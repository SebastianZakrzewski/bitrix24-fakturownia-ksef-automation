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

function buildMarkdown(report: LiveTestReport): string {
  const safetyRows = report.safety.checks
    .map(
      (check) =>
        `| ${check.code} | ${check.status} | ${check.message} |`,
    )
    .join('\n');

  return [
    '# Live Test Report',
    '',
    `**Scenario:** ${report.meta.scenarioId} (${report.meta.invoiceType})`,
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
    '## Scenario',
    '',
    `- Status: **${report.scenario.status}**`,
    report.scenario.message ? `- Message: ${report.scenario.message}` : '',
  ]
    .filter((line) => line !== undefined)
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
  await writeFile(markdownPath, buildMarkdown(report), 'utf8');

  return { jsonPath, markdownPath };
}
