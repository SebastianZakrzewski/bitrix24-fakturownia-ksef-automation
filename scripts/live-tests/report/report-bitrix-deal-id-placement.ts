import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import type { LiveTestReport } from '../types/live-test-report.types';

const CONFIGURED_DEAL_ID_REDACTION = '[CONFIGURED_BITRIX_DEAL_ID]';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function collectGuardedNumericBitrixDealIds(
  report: LiveTestReport,
): string[] {
  const ids = new Set<string>([LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID]);

  const actual = report.backendTriggerPreflight?.liveSmokeTarget?.actualBitrixDealId;
  const payload = report.backendTriggerPreflight?.request?.bitrix_deal_id;

  if (actual && !actual.startsWith('[TEST]')) {
    ids.add(actual);
  }

  if (payload && !payload.startsWith('[TEST]')) {
    ids.add(payload);
  }

  return [...ids];
}

function buildApprovedMarkdownDealIdLinePatterns(dealId: string): RegExp[] {
  const id = escapeRegex(dealId);

  return [
    new RegExp(`^-\\s*Actual Bitrix deal ID:\\s*\\*\\*${id}\\*\\*\\s*$`, 'i'),
    new RegExp(
      `^-\\s*Trigger payload deal ID \\(bitrix_deal_id\\):\\s*\\*\\*${id}\\*\\*\\s*$`,
      'i',
    ),
    new RegExp(`^-\\s*actualBitrixDealId:\\s*\\*\\*${id}\\*\\*\\s*$`, 'i'),
    new RegExp(`^-\\s*payload\\.bitrix_deal_id:\\s*\\*\\*${id}\\*\\*\\s*$`, 'i'),
    new RegExp(
      `^-\\s*backendTriggerPreflight\\b.*\\bbitrix_deal_id\\b.*\\*\\*${id}\\*\\*\\s*$`,
      'i',
    ),
  ];
}

/**
 * Returns true when the Markdown line is an approved backendTriggerPreflight field line
 * for the configured numeric Bitrix deal id.
 */
export function isApprovedMarkdownLineForDealId(
  line: string,
  dealId: string,
): boolean {
  if (!line.includes(dealId)) {
    return false;
  }

  const trimmed = line.trim();
  return buildApprovedMarkdownDealIdLinePatterns(dealId).some((pattern) =>
    pattern.test(trimmed),
  );
}

export function findUnapprovedMarkdownDealIdLines(
  markdown: string,
  report: LiveTestReport,
): string[] {
  const dealIds = collectGuardedNumericBitrixDealIds(report).filter(
    (id) => !id.startsWith('[TEST]'),
  );
  const unapproved: string[] = [];

  for (const line of markdown.split('\n')) {
    for (const dealId of dealIds) {
      if (line.includes(dealId) && !isApprovedMarkdownLineForDealId(line, dealId)) {
        unapproved.push(line.trim());
      }
    }
  }

  return unapproved;
}

export function assertBitrixDealIdOnlyInApprovedMarkdownContexts(
  markdown: string,
  report: LiveTestReport,
): void {
  const unapproved = findUnapprovedMarkdownDealIdLines(markdown, report);

  if (unapproved.length > 0) {
    throw new Error(
      `Bitrix deal id appears in unapproved Markdown context: ${unapproved.join(' | ')}`,
    );
  }
}

export function redactReportForRealDataMarkerCheck(
  report: LiveTestReport,
): LiveTestReport {
  const clone = JSON.parse(JSON.stringify(report)) as LiveTestReport;
  const preflight = clone.backendTriggerPreflight;

  if (preflight?.liveSmokeTarget?.actualBitrixDealId) {
    preflight.liveSmokeTarget.actualBitrixDealId = CONFIGURED_DEAL_ID_REDACTION;
  }

  if (preflight?.request?.bitrix_deal_id) {
    preflight.request.bitrix_deal_id = CONFIGURED_DEAL_ID_REDACTION;
  }

  return clone;
}

export function assertBitrixDealIdOnlyInApprovedReportFields(
  report: LiveTestReport,
  dealIdsToGuard: string[] = collectGuardedNumericBitrixDealIds(report),
): void {
  const remainder = JSON.stringify(redactReportForRealDataMarkerCheck(report));

  for (const dealId of dealIdsToGuard) {
    if (!dealId.trim() || dealId.startsWith('[TEST]')) {
      continue;
    }

    if (remainder.includes(dealId)) {
      throw new Error(
        `Bitrix deal id "${dealId}" appears outside approved report fields (backendTriggerPreflight.liveSmokeTarget.actualBitrixDealId and backendTriggerPreflight.request.bitrix_deal_id only)`,
      );
    }
  }
}

/**
 * Redacts numeric deal ids only on approved Markdown lines before forbidden-marker scan.
 * Unapproved lines are left unchanged so placement assertion can fail on leaks.
 */
export function markdownForRealDataMarkerCheck(
  markdown: string,
  report: LiveTestReport,
): string {
  const dealIds = collectGuardedNumericBitrixDealIds(report).filter(
    (id) => !id.startsWith('[TEST]'),
  );

  return markdown
    .split('\n')
    .map((line) => {
      let updated = line;

      for (const dealId of dealIds) {
        if (
          updated.includes(dealId) &&
          isApprovedMarkdownLineForDealId(updated, dealId)
        ) {
          updated = updated.split(dealId).join(CONFIGURED_DEAL_ID_REDACTION);
        }
      }

      return updated;
    })
    .join('\n');
}
