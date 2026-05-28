import type { MatrixLiveE2eCaseResult, MatrixLiveE2eRunSummary } from './matrix-live-e2e.types';
import {
  MATRIX_LIVE_E2E_MODE,
  MATRIX_LIVE_E2E_RUNNER_VERSION,
} from './matrix-live-e2e.types';
import { isMatrixBackendTriggerWorkflowSuccess } from './matrix-backend-trigger.types';

export function buildMatrixLiveE2eRunSummary(
  cases: MatrixLiveE2eCaseResult[],
  startedAt: Date,
  finishedAt: Date,
  options: { backendTriggerEnabled?: boolean } = {},
): MatrixLiveE2eRunSummary {
  const byInvoiceType = {
    FULL: summarizeType(cases, 'FULL'),
    ADVANCE: summarizeType(cases, 'ADVANCE'),
    FINAL: summarizeType(cases, 'FINAL'),
  };

  const backendTriggerEnabled = options.backendTriggerEnabled ?? false;

  return {
    mode: MATRIX_LIVE_E2E_MODE,
    runnerVersion: MATRIX_LIVE_E2E_RUNNER_VERSION,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalCases: cases.length,
    completed: cases.filter((item) => item.status === 'MATRIX_LIVE_E2E_COMPLETED').length,
    blocked: cases.filter((item) => item.status === 'MATRIX_LIVE_E2E_BLOCKED').length,
    failed: cases.filter((item) => item.status === 'MATRIX_LIVE_E2E_FAILED').length,
    backendTriggerEnabled,
    backendTriggerSent: cases.filter((item) => item.backendTriggerRequestSent).length,
    backendTriggerWorkflowSuccess: cases.filter((item) =>
      isCaseBackendWorkflowSuccess(item),
    ).length,
    byInvoiceType,
    cases,
  };
}

function isCaseBackendWorkflowSuccess(item: MatrixLiveE2eCaseResult): boolean {
  const outcomes = [item.backendTrigger, item.advanceSeedBackendTrigger].filter(Boolean);

  if (outcomes.length === 0) {
    return false;
  }

  return outcomes.every((outcome) =>
    isMatrixBackendTriggerWorkflowSuccess({
      httpStatus: outcome!.httpStatus,
      triggerStatus: outcome!.triggerStatus,
    }),
  );
}

function summarizeType(
  cases: MatrixLiveE2eCaseResult[],
  invoiceType: MatrixLiveE2eCaseResult['invoiceType'],
): { total: number; completed: number; blocked: number; failed: number } {
  const filtered = cases.filter((item) => item.invoiceType === invoiceType);

  return {
    total: filtered.length,
    completed: filtered.filter((item) => item.status === 'MATRIX_LIVE_E2E_COMPLETED').length,
    blocked: filtered.filter((item) => item.status === 'MATRIX_LIVE_E2E_BLOCKED').length,
    failed: filtered.filter((item) => item.status === 'MATRIX_LIVE_E2E_FAILED').length,
  };
}

export function buildMatrixLiveE2eReportMarkdown(summary: MatrixLiveE2eRunSummary): string {
  const lines: string[] = [
    '# Invoice Matrix Live E2E Report',
    '',
    `**Mode:** ${summary.mode}`,
    `**Runner:** ${summary.runnerVersion}`,
    `**Started:** ${summary.startedAt}`,
    `**Finished:** ${summary.finishedAt}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total cases | ${summary.totalCases} |`,
    `| Completed | ${summary.completed} |`,
    `| Blocked | ${summary.blocked} |`,
    `| Failed | ${summary.failed} |`,
    `| Backend trigger enabled | ${summary.backendTriggerEnabled} |`,
    `| Backend trigger sent | ${summary.backendTriggerSent} |`,
    `| Backend workflow success | ${summary.backendTriggerWorkflowSuccess} |`,
    '',
    '## By invoice type',
    '',
    '| Type | Total | Completed | Blocked | Failed |',
    '|------|-------|-----------|---------|--------|',
  ];

  for (const type of ['FULL', 'ADVANCE', 'FINAL'] as const) {
    const row = summary.byInvoiceType[type];
    lines.push(`| ${type} | ${row.total} | ${row.completed} | ${row.blocked} | ${row.failed} |`);
  }

  lines.push('', '## Cases', '');
  lines.push(
    '| Case ID | Type | Status | Bitrix deal ID | Backend status | Deal title | Errors |',
  );
  lines.push(
    '|---------|------|--------|--------------|----------------|------------|--------|',
  );

  for (const item of summary.cases) {
    lines.push(
      `| ${item.caseId} | ${item.invoiceType} | ${item.status} | ${item.bitrixDealId ?? '-'} | ${escapeCell(formatBackendStatus(item))} | ${escapeCell(item.dealTitle)} | ${escapeCell(item.errors.join('; ') || item.gateBlockers.join('; ') || '-')} |`,
    );
  }

  lines.push(
    '',
    '## Notes',
    '',
    '- Runner creates Bitrix deals and moves stage to paid stage.',
    '- When `LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER=true`, runner POSTs `/invoice-processes/bitrix-trigger` directly (Option B).',
    '- FINAL cases seed ADVANCE on the same deal before FINAL trigger when backend trigger is enabled.',
    '- Guard matrix cases (contract/adapter/backend validation) are excluded from live E2E by design.',
  );

  return lines.join('\n');
}

function formatBackendStatus(item: MatrixLiveE2eCaseResult): string {
  if (!item.backendTriggerRequestSent) {
    return 'not sent';
  }

  const parts: string[] = [];

  if (item.advanceSeedBackendTrigger?.triggerStatus) {
    parts.push(`ADVANCE seed=${item.advanceSeedBackendTrigger.triggerStatus}`);
  }

  if (item.backendTrigger?.triggerStatus) {
    parts.push(`${item.invoiceType}=${item.backendTrigger.triggerStatus}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'sent';
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
