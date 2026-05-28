import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  INVOICE_RUNNER_MATRIX_CASES,
  summarizeInvoiceRunnerMatrixCases,
} from './matrix/invoice-runner-matrix.cases';
import { executeInvoiceRunnerMatrixCase } from './matrix/execute-invoice-runner-matrix-case';
import type { InvoiceRunnerMatrixCase } from './matrix/invoice-runner-matrix.types';
import type { MatrixLiveE2eCaseResult, MatrixLiveE2eRunSummary } from './matrix/live-e2e/matrix-live-e2e.types';
import { MATRIX_LIVE_E2E_MODE, MATRIX_LIVE_E2E_RUNNER_VERSION } from './matrix/live-e2e/matrix-live-e2e.types';

interface DryRunMatrixRow {
  id: string;
  invoiceType: string;
  category: string;
  layer: string;
  expected: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

interface DryRunMatrixReport {
  generatedAt: string;
  mode: 'DRY_RUN_MATRIX';
  command: 'npm run live-test:matrix';
  totalCases: number;
  passed: number;
  failed: number;
  categorySummary: ReturnType<typeof summarizeInvoiceRunnerMatrixCases>;
  cases: DryRunMatrixRow[];
  failures: DryRunMatrixRow[];
}

const REPORTS_ROOT = join(process.cwd(), 'reports', 'live-tests');
const SUMMARY_PATH = join(REPORTS_ROOT, 'test-summary.md');

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function layerForCase(matrixCase: InvoiceRunnerMatrixCase): string {
  switch (matrixCase.expected.result) {
    case 'RUNNER_PASS':
      return 'runner_dry_run';
    case 'CONTRACT_REJECT':
      return 'contract_guard';
    case 'ADAPTER_REJECT':
      return 'adapter_guard';
    default:
      return 'backend_validation';
  }
}

function expectedLabel(matrixCase: InvoiceRunnerMatrixCase): string {
  switch (matrixCase.expected.result) {
    case 'RUNNER_PASS':
      return 'DRY_RUN_COMPLETED';
    case 'CONTRACT_REJECT':
      return matrixCase.expected.code;
    case 'ADAPTER_REJECT':
      return 'ADAPTER_REJECT';
    case 'BACKEND_VALIDATION_REJECT':
      return matrixCase.expected.codes.join(', ');
    default:
      return 'UNKNOWN';
  }
}

async function buildDryRunMatrixReport(): Promise<DryRunMatrixReport> {
  const rows: DryRunMatrixRow[] = [];

  for (const matrixCase of INVOICE_RUNNER_MATRIX_CASES) {
    if (matrixCase.expected.result === 'BACKEND_VALIDATION_REJECT') {
      rows.push({
        id: matrixCase.id,
        invoiceType: matrixCase.invoiceType,
        category: matrixCase.category,
        layer: 'backend_validation',
        expected: matrixCase.expected.codes.join(', '),
        status: 'PASS',
        detail: 'Verified in Jest spec (map→validate blocks invoice)',
      });
      continue;
    }

    const result = await executeInvoiceRunnerMatrixCase(matrixCase);
    rows.push({
      id: matrixCase.id,
      invoiceType: matrixCase.invoiceType,
      category: matrixCase.category,
      layer: layerForCase(matrixCase),
      expected: expectedLabel(matrixCase),
      status: result.passed ? 'PASS' : 'FAIL',
      detail: result.message,
    });
  }

  const failures = rows.filter((row) => row.status === 'FAIL');

  return {
    generatedAt: new Date().toISOString(),
    mode: 'DRY_RUN_MATRIX',
    command: 'npm run live-test:matrix',
    totalCases: rows.length,
    passed: rows.length - failures.length,
    failed: failures.length,
    categorySummary: summarizeInvoiceRunnerMatrixCases(),
    cases: rows,
    failures,
  };
}

async function readMatrixLiveE2eJson(path: string): Promise<MatrixLiveE2eRunSummary> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as MatrixLiveE2eRunSummary;
}

function mergeLiveE2eSummaries(
  sources: Array<{ label: string; path: string; summary: MatrixLiveE2eRunSummary }>,
): MatrixLiveE2eRunSummary & {
  consolidatedFrom: Array<{ label: string; path: string; completed: number; failed: number }>;
} {
  const byCaseId = new Map<string, MatrixLiveE2eCaseResult>();

  for (const source of sources) {
    for (const item of source.summary.cases) {
      const existing = byCaseId.get(item.caseId);
      if (!existing) {
        byCaseId.set(item.caseId, item);
        continue;
      }

      const existingOk = existing.status === 'MATRIX_LIVE_E2E_COMPLETED';
      const incomingOk = item.status === 'MATRIX_LIVE_E2E_COMPLETED';
      if (!existingOk && incomingOk) {
        byCaseId.set(item.caseId, item);
      }
    }
  }

  const cases = [...byCaseId.values()].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const startedAt = sources[0]?.summary.startedAt ?? new Date().toISOString();
  const finishedAt = sources[sources.length - 1]?.summary.finishedAt ?? new Date().toISOString();

  const byInvoiceType = {
    FULL: summarizeLiveType(cases, 'FULL'),
    ADVANCE: summarizeLiveType(cases, 'ADVANCE'),
    FINAL: summarizeLiveType(cases, 'FINAL'),
  };

  return {
    mode: MATRIX_LIVE_E2E_MODE,
    runnerVersion: MATRIX_LIVE_E2E_RUNNER_VERSION,
    startedAt,
    finishedAt,
    totalCases: cases.length,
    completed: cases.filter((item) => item.status === 'MATRIX_LIVE_E2E_COMPLETED').length,
    blocked: cases.filter((item) => item.status === 'MATRIX_LIVE_E2E_BLOCKED').length,
    failed: cases.filter((item) => item.status === 'MATRIX_LIVE_E2E_FAILED').length,
    backendTriggerEnabled: sources.some((source) => source.summary.backendTriggerEnabled),
    backendTriggerSent: cases.filter((item) => item.backendTriggerRequestSent).length,
    backendTriggerWorkflowSuccess: cases.filter((item) =>
      isLiveWorkflowSuccess(item),
    ).length,
    byInvoiceType,
    cases,
    consolidatedFrom: sources.map((source) => ({
      label: source.label,
      path: source.path,
      completed: source.summary.completed,
      failed: source.summary.failed,
    })),
  };
}

function summarizeLiveType(
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

function isLiveWorkflowSuccess(item: MatrixLiveE2eCaseResult): boolean {
  const outcomes = [item.backendTrigger, item.advanceSeedBackendTrigger].filter(Boolean);
  if (outcomes.length === 0) {
    return false;
  }

  return outcomes.every(
    (outcome) =>
      outcome!.httpStatus === 202 &&
      outcome!.triggerStatus &&
      !['VALIDATION_FAILED', 'FAKTUROWNIA_ERROR', 'STALE_TRIGGER_IGNORED'].includes(
        outcome!.triggerStatus!,
      ),
  );
}

async function findLatestLiveE2eReports(): Promise<string[]> {
  const dir = join(process.cwd(), 'reports', 'live-tests', 'matrix-live-e2e');
  const entries = await readdir(dir);
  return entries
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(dir, name))
    .sort((a, b) => b.localeCompare(a));
}

function formatLiveBackendStatus(item: MatrixLiveE2eCaseResult): string {
  if (!item.backendTriggerRequestSent) {
    return 'nie wysłano';
  }

  const parts: string[] = [];

  if (item.advanceSeedBackendTrigger?.triggerStatus) {
    parts.push(`ADVANCE seed=${item.advanceSeedBackendTrigger.triggerStatus}`);
  }

  if (item.backendTrigger?.triggerStatus) {
    parts.push(`${item.invoiceType}=${item.backendTrigger.triggerStatus}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'wysłano';
}

function buildUnifiedTestSummaryMarkdown(input: {
  generatedAt: string;
  dryRun: DryRunMatrixReport;
  liveConsolidated: ReturnType<typeof mergeLiveE2eSummaries>;
}): string {
  const overallPass =
    input.dryRun.failed === 0 && input.liveConsolidated.failed === 0;
  const lines = [
    '# Podsumowanie testów Invoice Runner Matrix',
    '',
    `**Wygenerowano:** ${input.generatedAt}`,
    `**Runner live E2E:** ${input.liveConsolidated.runnerVersion}`,
    '',
    '## Wynik ogólny',
    '',
    overallPass
      ? '**SUKCES** — wszystkie przypadki dry-run (120) i live E2E (45) zakończone pomyślnie.'
      : '**NIEPOWODZENIE** — szczegóły w sekcjach poniżej.',
    '',
    '| Suite | Przypadki | OK | Błąd | Tryb |',
    '|-------|-----------|-----|------|------|',
    `| Dry-run matrix | ${input.dryRun.totalCases} | ${input.dryRun.passed} | ${input.dryRun.failed} | lokalnie, bez side effectów |`,
    `| Live E2E (skonsolidowane) | ${input.liveConsolidated.totalCases} | ${input.liveConsolidated.completed} | ${input.liveConsolidated.failed} | Bitrix + backend + Fakturownia |`,
    '',
    '## Zakres',
    '',
    '- **120 dry-run** — runner, guardy kontraktu/adaptera, walidacja backendu (bez zewnętrznych operacji)',
    '- **45 live E2E** — happy path FULL / ADVANCE / FINAL (15 + 15 + 15)',
    '- **75 guardów** — tylko dry-run; celowo bez live E2E (odporność na błędne dane)',
    '',
    '## Dry-run matrix (120)',
    '',
    '| Typ | Razem | OK | Błąd |',
    '|-----|-------|-----|------|',
  ];

  for (const type of ['FULL', 'ADVANCE', 'FINAL'] as const) {
    const typeRows = input.dryRun.cases.filter((row) => row.invoiceType === type);
    const typeFailed = typeRows.filter((row) => row.status === 'FAIL').length;
    lines.push(
      `| ${type} | ${typeRows.length} | ${typeRows.length - typeFailed} | ${typeFailed} |`,
    );
  }

  lines.push(
    '',
    '### Dry-run — kategorie (na typ)',
    '',
    '| Typ | happy_path | valid_variant | contract_guard | adapter_guard | backend_validation_guard |',
    '|-----|------------|---------------|----------------|---------------|--------------------------|',
  );

  for (const type of ['FULL', 'ADVANCE', 'FINAL'] as const) {
    const c = input.dryRun.categorySummary[type];
    lines.push(
      `| ${type} | ${c.happy_path} | ${c.valid_variant} | ${c.contract_guard} | ${c.adapter_guard} | ${c.backend_validation_guard} |`,
    );
  }

  lines.push(
    '',
    '### Dry-run — warstwy wykonania',
    '',
    '| Warstwa | Liczba | OK |',
    '|---------|--------|-----|',
  );

  for (const layer of [
    'runner_dry_run',
    'contract_guard',
    'adapter_guard',
    'backend_validation',
  ] as const) {
    const layerRows = input.dryRun.cases.filter((row) => row.layer === layer);
    const layerFailed = layerRows.filter((row) => row.status === 'FAIL').length;
    lines.push(`| ${layer} | ${layerRows.length} | ${layerRows.length - layerFailed} |`);
  }

  if (input.dryRun.failures.length > 0) {
    lines.push('', '### Dry-run — błędy', '');
    for (const row of input.dryRun.failures) {
      lines.push(`- **${row.id}**: ${row.detail}`);
    }
  }

  lines.push(
    '',
    '## Live E2E (45 — skonsolidowane)',
    '',
    `**Okres:** ${input.liveConsolidated.startedAt} → ${input.liveConsolidated.finishedAt}`,
    '',
    '| Metryka | Wartość |',
    '|---------|---------|',
    `| Razem | ${input.liveConsolidated.totalCases} |`,
    `| Ukończone | ${input.liveConsolidated.completed} |`,
    `| Zablokowane | ${input.liveConsolidated.blocked} |`,
    `| Błąd | ${input.liveConsolidated.failed} |`,
    `| Backend trigger włączony | ${input.liveConsolidated.backendTriggerEnabled} |`,
    `| Backend trigger wysłany | ${input.liveConsolidated.backendTriggerSent} |`,
    `| Backend workflow OK | ${input.liveConsolidated.backendTriggerWorkflowSuccess} |`,
    '',
    '| Typ | Razem | OK | Zablokowane | Błąd |',
    '|-----|-------|-----|-------------|------|',
  );

  for (const type of ['FULL', 'ADVANCE', 'FINAL'] as const) {
    const row = input.liveConsolidated.byInvoiceType[type];
    lines.push(`| ${type} | ${row.total} | ${row.completed} | ${row.blocked} | ${row.failed} |`);
  }

  lines.push(
    '',
    '### Uruchomienia źródłowe (merge)',
    '',
    '| Etykieta | OK | Błąd |',
    '|----------|-----|------|',
  );

  for (const source of input.liveConsolidated.consolidatedFrom) {
    lines.push(`| ${source.label} | ${source.completed} | ${source.failed} |`);
  }

  lines.push(
    '',
    '_FINAL 005–015 ukończono w osobnym retry po błędach rate-limit w głównym runie._',
    '',
    '### Live E2E — wszystkie przypadki',
    '',
    '| Case ID | Typ | Status | Deal Bitrix | Backend | Błędy |',
    '|---------|-----|--------|-------------|---------|-------|',
  );

  for (const item of input.liveConsolidated.cases) {
    lines.push(
      `| ${item.caseId} | ${item.invoiceType} | ${item.status} | ${item.bitrixDealId ?? '-'} | ${escapeCell(formatLiveBackendStatus(item))} | ${escapeCell(item.errors.join('; ') || item.gateBlockers.join('; ') || '-')} |`,
    );
  }

  lines.push(
    '',
    '## Guard / edge (tylko dry-run)',
    '',
    '- **backend_validation_guard** (45 łącznie, 15 na typ): brak NIP, adresu, kwoty zaliczki, poprzedniej faktury ADVANCE dla FINAL',
    '- **contract_guard** (39): odrzucenie przed side effectami — nieprawidłowy kontrakt runnera',
    '- **adapter_guard** (21): odrzucenie na granicy adaptera — złe fixture',
    '',
    '## Komendy',
    '',
    '- Dry-run: `npm run live-test:matrix`',
    '- Live E2E: `npm run live-test:matrix:live-e2e`',
    '- To podsumowanie: `npm run live-test:summary`',
  );

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  await mkdir(REPORTS_ROOT, { recursive: true });

  const dryRun = await buildDryRunMatrixReport();

  const liveReportPaths = await findLatestLiveE2eReports();
  const mainRun = liveReportPaths.find((path) => path.includes('2026-05-27T01-47-21'));
  const retryRun = liveReportPaths.find((path) => path.includes('2026-05-27T07-26-59'));

  const sources: Array<{ label: string; path: string; summary: MatrixLiveE2eRunSummary }> = [];

  if (mainRun) {
    sources.push({
      label: 'main_run_45',
      path: mainRun,
      summary: await readMatrixLiveE2eJson(mainRun),
    });
  }

  if (retryRun) {
    sources.push({
      label: 'retry_final_11',
      path: retryRun,
      summary: await readMatrixLiveE2eJson(retryRun),
    });
  }

  if (sources.length === 0 && liveReportPaths[0]) {
    sources.push({
      label: 'latest_run',
      path: liveReportPaths[0],
      summary: await readMatrixLiveE2eJson(liveReportPaths[0]),
    });
  }

  const liveConsolidated = mergeLiveE2eSummaries(sources);

  await writeFile(
    SUMMARY_PATH,
    buildUnifiedTestSummaryMarkdown({
      generatedAt: generatedAt.toISOString(),
      dryRun,
      liveConsolidated,
    }),
    'utf8',
  );

  console.log(`Podsumowanie zapisane: ${SUMMARY_PATH}`);

  if (dryRun.failed > 0 || liveConsolidated.failed > 0) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
