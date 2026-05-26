import { DRY_RUN_STEP_NAMES } from '../execution/dry-run-steps';

/** Documented paid stage for Evapremium V1 (`contracts.md`). */
export const BITRIX_PAID_STAGE_ID = 'PREPARATION';

/** Bitrix enum: Pełna Płatność (FULL / FINAL after advance). */
export const BITRIX_PAYMENT_FORM_FULL_VALUE_ID = '718';

/** Bitrix enum: Zaliczka (ADVANCE). */
export const BITRIX_PAYMENT_FORM_ADVANCE_VALUE_ID = '720';

/** Bitrix enum: Dopełniająca → FINAL. */
export const BITRIX_INVOICE_DOCUMENT_TYPE_FINAL_VALUE_ID = '1328';

export const EXPECTED_DRY_RUN_EXTERNAL_STEPS_SKIPPED = [
  DRY_RUN_STEP_NAMES.SIMULATE_BITRIX_DEAL_SETUP,
  DRY_RUN_STEP_NAMES.SIMULATE_BACKEND_WORKFLOW,
  DRY_RUN_STEP_NAMES.SIMULATE_FAKTUROWNIA_ORDER_INVOICE,
] as const;

/** Patterns that must not appear in local fixtures (real customer/production markers). */
export const FORBIDDEN_REAL_DATA_MARKERS = [
  /evapremium\s+s\.?a\.?/i,
  /\b27000\b/,
  /\b27414\b/,
  /\b18690\b/,
  /kmepxyervpeujwvgdqtm/i,
  /@.+\.(pl|com)/i,
] as const;

export function assertSyntheticFixtureData(value: string): void {
  for (const pattern of FORBIDDEN_REAL_DATA_MARKERS) {
    if (pattern.test(value)) {
      throw new Error(`Fixture contains forbidden real-data marker: ${value}`);
    }
  }
}

export function hasTestDealPrefix(dealId: string): boolean {
  return dealId.startsWith('[TEST]');
}
