export const DRY_RUN_STEP_NAMES = {
  VALIDATE_SAFETY_GUARDS: 'validate_safety_guards',
  PREPARE_TEST_CONTEXT: 'prepare_test_context',
  SIMULATE_BITRIX_DEAL_SETUP: 'simulate_bitrix_test_deal_setup',
  SIMULATE_BACKEND_WORKFLOW: 'simulate_backend_workflow',
  SIMULATE_FAKTUROWNIA_ORDER_INVOICE: 'simulate_fakturownia_order_invoice',
  MARK_KSEF: 'mark_ksef',
  MARK_BITRIX_SYNC: 'mark_bitrix_sync',
  WRITE_REPORT: 'write_report',
} as const;

export type DryRunStepName =
  (typeof DRY_RUN_STEP_NAMES)[keyof typeof DRY_RUN_STEP_NAMES];
