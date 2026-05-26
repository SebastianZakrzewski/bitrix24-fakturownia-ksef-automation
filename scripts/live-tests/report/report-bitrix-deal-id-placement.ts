import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import type { LiveTestReport } from '../types/live-test-report.types';

const CONFIGURED_DEAL_ID_REDACTION = '[CONFIGURED_BITRIX_DEAL_ID]';

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

export function redactMarkdownForRealDataMarkerCheck(
  markdown: string,
  report: LiveTestReport,
): string {
  let text = markdown;
  const ids = collectGuardedNumericBitrixDealIds(report).filter(
    (id) => !id.startsWith('[TEST]'),
  );

  for (const dealId of ids) {
    text = text.split(dealId).join(CONFIGURED_DEAL_ID_REDACTION);
  }

  return text;
}
