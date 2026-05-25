import type { LiveTestEnv } from './live-test-env';
import type { SafetyCheck } from './types/live-test-report.types';

export type LiveTestGuardCode =
  | 'LIVE_TEST_MODE_REQUIRED'
  | 'LIVE_TEST_CONFIRM_REQUIRED'
  | 'EXTERNAL_SIDE_EFFECTS_REQUIRED'
  | 'TEST_DEAL_CREATION_REQUIRED'
  | 'TEST_DEAL_PREFIX_INVALID'
  | 'BULK_LIVE_TESTS_NOT_ALLOWED'
  | 'DELETE_OR_CANCEL_FORBIDDEN';

export class LiveTestGuardError extends Error {
  readonly code: LiveTestGuardCode;

  constructor(code: LiveTestGuardCode, message: string) {
    super(message);
    this.name = 'LiveTestGuardError';
    this.code = code;
  }
}

export interface SafetyGuardContext {
  requiresExternalSideEffects: boolean;
  requiresTestDealCreation: boolean;
  scenarioCount: number;
  requestsDeleteOrCancel: boolean;
}

export const DEFAULT_TEST_DEAL_PREFIX = '[TEST]';

export function isValidTestDealPrefix(prefix: string): boolean {
  return prefix === DEFAULT_TEST_DEAL_PREFIX || prefix.startsWith('[TEST]');
}

export function assertDeleteOrCancelForbidden(): void {
  throw new LiveTestGuardError(
    'DELETE_OR_CANCEL_FORBIDDEN',
    'Delete and cancel operations are forbidden in V1 live tests',
  );
}

function checkLiveTestMode(env: LiveTestEnv): SafetyCheck {
  if (env.LIVE_TEST_MODE) {
    return {
      code: 'LIVE_TEST_MODE_REQUIRED',
      status: 'passed',
      message: 'LIVE_TEST_MODE is enabled',
    };
  }

  return {
    code: 'LIVE_TEST_MODE_REQUIRED',
    status: 'failed',
    message: 'LIVE_TEST_MODE must be true to run live tests',
  };
}

function checkExternalSideEffects(
  env: LiveTestEnv,
  required: boolean,
): SafetyCheck[] {
  if (!required) {
    return [
      {
        code: 'LIVE_TEST_CONFIRM_REQUIRED',
        status: 'skipped',
        message: 'Scenario does not require external side effects',
      },
      {
        code: 'EXTERNAL_SIDE_EFFECTS_REQUIRED',
        status: 'skipped',
        message: 'Scenario does not require external side effects',
      },
    ];
  }

  const confirmCheck: SafetyCheck = env.LIVE_TEST_CONFIRM
    ? {
        code: 'LIVE_TEST_CONFIRM_REQUIRED',
        status: 'passed',
        message: 'LIVE_TEST_CONFIRM is enabled',
      }
    : {
        code: 'LIVE_TEST_CONFIRM_REQUIRED',
        status: 'failed',
        message: 'LIVE_TEST_CONFIRM must be true for external side effects',
      };

  const sideEffectsCheck: SafetyCheck = env.ENABLE_EXTERNAL_SIDE_EFFECTS
    ? {
        code: 'EXTERNAL_SIDE_EFFECTS_REQUIRED',
        status: 'passed',
        message: 'ENABLE_EXTERNAL_SIDE_EFFECTS is enabled',
      }
    : {
        code: 'EXTERNAL_SIDE_EFFECTS_REQUIRED',
        status: 'failed',
        message:
          'ENABLE_EXTERNAL_SIDE_EFFECTS must be true for external side effects',
      };

  return [confirmCheck, sideEffectsCheck];
}

function checkTestDealCreation(env: LiveTestEnv, required: boolean): SafetyCheck {
  if (!required) {
    return {
      code: 'TEST_DEAL_CREATION_REQUIRED',
      status: 'skipped',
      message: 'Scenario does not require test deal creation',
    };
  }

  if (env.ALLOW_TEST_DEAL_CREATION) {
    return {
      code: 'TEST_DEAL_CREATION_REQUIRED',
      status: 'passed',
      message: 'ALLOW_TEST_DEAL_CREATION is enabled',
    };
  }

  return {
    code: 'TEST_DEAL_CREATION_REQUIRED',
    status: 'failed',
    message: 'ALLOW_TEST_DEAL_CREATION must be true for test deal creation',
  };
}

function checkTestDealPrefix(env: LiveTestEnv): SafetyCheck {
  if (isValidTestDealPrefix(env.TEST_DEAL_PREFIX)) {
    return {
      code: 'TEST_DEAL_PREFIX_INVALID',
      status: 'passed',
      message: `TEST_DEAL_PREFIX is valid (${env.TEST_DEAL_PREFIX})`,
    };
  }

  return {
    code: 'TEST_DEAL_PREFIX_INVALID',
    status: 'failed',
    message: `TEST_DEAL_PREFIX must be "${DEFAULT_TEST_DEAL_PREFIX}" or start with "[TEST]"`,
  };
}

function checkBulkLiveTests(env: LiveTestEnv, scenarioCount: number): SafetyCheck {
  if (scenarioCount <= 1) {
    return {
      code: 'BULK_LIVE_TESTS_NOT_ALLOWED',
      status: 'skipped',
      message: 'Single scenario run does not require bulk permission',
    };
  }

  if (env.ALLOW_BULK_LIVE_TESTS) {
    return {
      code: 'BULK_LIVE_TESTS_NOT_ALLOWED',
      status: 'passed',
      message: 'ALLOW_BULK_LIVE_TESTS is enabled',
    };
  }

  return {
    code: 'BULK_LIVE_TESTS_NOT_ALLOWED',
    status: 'failed',
    message: 'ALLOW_BULK_LIVE_TESTS must be true when running multiple scenarios',
  };
}

function checkDeleteOrCancel(requested: boolean): SafetyCheck {
  if (!requested) {
    return {
      code: 'DELETE_OR_CANCEL_FORBIDDEN',
      status: 'skipped',
      message: 'No delete or cancel operation requested',
    };
  }

  return {
    code: 'DELETE_OR_CANCEL_FORBIDDEN',
    status: 'failed',
    message: 'Delete and cancel operations are forbidden in V1 live tests',
  };
}

export function collectSafetyChecks(
  env: LiveTestEnv,
  context: SafetyGuardContext,
): SafetyCheck[] {
  return [
    checkLiveTestMode(env),
    ...checkExternalSideEffects(env, context.requiresExternalSideEffects),
    checkTestDealCreation(env, context.requiresTestDealCreation),
    checkTestDealPrefix(env),
    checkBulkLiveTests(env, context.scenarioCount),
    checkDeleteOrCancel(context.requestsDeleteOrCancel),
  ];
}

function findFirstFailedCheck(checks: SafetyCheck[]): SafetyCheck | undefined {
  return checks.find((check) => check.status === 'failed');
}

export function validateSafetyGuards(
  env: LiveTestEnv,
  context: SafetyGuardContext,
): SafetyCheck[] {
  if (context.requestsDeleteOrCancel) {
    assertDeleteOrCancelForbidden();
  }

  const checks = collectSafetyChecks(env, context);
  const failed = findFirstFailedCheck(checks);

  if (failed) {
    throw new LiveTestGuardError(
      failed.code as LiveTestGuardCode,
      failed.message,
    );
  }

  return checks;
}
