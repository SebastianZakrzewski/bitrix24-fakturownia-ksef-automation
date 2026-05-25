import type { LiveTestEnv } from './live-test-env';
import {
  assertDeleteOrCancelForbidden,
  collectSafetyChecks,
  isValidTestDealPrefix,
  LiveTestGuardError,
  validateSafetyGuards,
  type SafetyGuardContext,
} from './safety-guards';

function createValidEnv(overrides: Partial<LiveTestEnv> = {}): LiveTestEnv {
  return {
    LIVE_TEST_MODE: true,
    LIVE_TEST_CONFIRM: false,
    ENABLE_EXTERNAL_SIDE_EFFECTS: false,
    ALLOW_TEST_DEAL_CREATION: false,
    TEST_DEAL_PREFIX: '[TEST]',
    ALLOW_BULK_LIVE_TESTS: false,
    ALLOW_DELETE_OR_CANCEL: false,
    ...overrides,
  };
}

const placeholderContext: SafetyGuardContext = {
  requiresExternalSideEffects: false,
  requiresTestDealCreation: false,
  scenarioCount: 1,
  requestsDeleteOrCancel: false,
};

describe('isValidTestDealPrefix', () => {
  it('accepts [TEST] and prefixes starting with [TEST]', () => {
    expect(isValidTestDealPrefix('[TEST]')).toBe(true);
    expect(isValidTestDealPrefix('[TEST] Evapremium deal')).toBe(true);
  });

  it('rejects invalid prefixes', () => {
    expect(isValidTestDealPrefix('TEST')).toBe(false);
    expect(isValidTestDealPrefix('')).toBe(false);
  });
});

describe('validateSafetyGuards', () => {
  it('passes for minimal placeholder context', () => {
    const checks = validateSafetyGuards(createValidEnv(), placeholderContext);

    expect(checks.some((check) => check.code === 'LIVE_TEST_MODE_REQUIRED')).toBe(
      true,
    );
    expect(checks.every((check) => check.status !== 'failed')).toBe(true);
  });

  it('refuses when LIVE_TEST_MODE is false', () => {
    expect(() =>
      validateSafetyGuards(
        createValidEnv({ LIVE_TEST_MODE: false }),
        placeholderContext,
      ),
    ).toThrow(LiveTestGuardError);

    try {
      validateSafetyGuards(
        createValidEnv({ LIVE_TEST_MODE: false }),
        placeholderContext,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(LiveTestGuardError);
      expect((error as LiveTestGuardError).code).toBe('LIVE_TEST_MODE_REQUIRED');
    }
  });

  it('refuses external side effects without LIVE_TEST_CONFIRM', () => {
    expect(() =>
      validateSafetyGuards(createValidEnv(), {
        ...placeholderContext,
        requiresExternalSideEffects: true,
      }),
    ).toThrow(LiveTestGuardError);

    try {
      validateSafetyGuards(createValidEnv(), {
        ...placeholderContext,
        requiresExternalSideEffects: true,
      });
    } catch (error) {
      expect((error as LiveTestGuardError).code).toBe('LIVE_TEST_CONFIRM_REQUIRED');
    }
  });

  it('refuses external side effects without ENABLE_EXTERNAL_SIDE_EFFECTS', () => {
    expect(() =>
      validateSafetyGuards(
        createValidEnv({ LIVE_TEST_CONFIRM: true }),
        {
          ...placeholderContext,
          requiresExternalSideEffects: true,
        },
      ),
    ).toThrow(LiveTestGuardError);

    try {
      validateSafetyGuards(
        createValidEnv({ LIVE_TEST_CONFIRM: true }),
        {
          ...placeholderContext,
          requiresExternalSideEffects: true,
        },
      );
    } catch (error) {
      expect((error as LiveTestGuardError).code).toBe(
        'EXTERNAL_SIDE_EFFECTS_REQUIRED',
      );
    }
  });

  it('allows external side effects when confirm flags are enabled', () => {
    const checks = validateSafetyGuards(
      createValidEnv({
        LIVE_TEST_CONFIRM: true,
        ENABLE_EXTERNAL_SIDE_EFFECTS: true,
      }),
      {
        ...placeholderContext,
        requiresExternalSideEffects: true,
      },
    );

    expect(
      checks.find((check) => check.code === 'LIVE_TEST_CONFIRM_REQUIRED')?.status,
    ).toBe('passed');
    expect(
      checks.find((check) => check.code === 'EXTERNAL_SIDE_EFFECTS_REQUIRED')
        ?.status,
    ).toBe('passed');
  });

  it('refuses test deal creation without ALLOW_TEST_DEAL_CREATION', () => {
    expect(() =>
      validateSafetyGuards(createValidEnv(), {
        ...placeholderContext,
        requiresTestDealCreation: true,
      }),
    ).toThrow(LiveTestGuardError);

    try {
      validateSafetyGuards(createValidEnv(), {
        ...placeholderContext,
        requiresTestDealCreation: true,
      });
    } catch (error) {
      expect((error as LiveTestGuardError).code).toBe('TEST_DEAL_CREATION_REQUIRED');
    }
  });

  it('refuses invalid TEST_DEAL_PREFIX', () => {
    expect(() =>
      validateSafetyGuards(
        createValidEnv({ TEST_DEAL_PREFIX: 'PRODUCTION' }),
        placeholderContext,
      ),
    ).toThrow(LiveTestGuardError);

    try {
      validateSafetyGuards(
        createValidEnv({ TEST_DEAL_PREFIX: 'PRODUCTION' }),
        placeholderContext,
      );
    } catch (error) {
      expect((error as LiveTestGuardError).code).toBe('TEST_DEAL_PREFIX_INVALID');
    }
  });

  it('refuses bulk runs without ALLOW_BULK_LIVE_TESTS', () => {
    expect(() =>
      validateSafetyGuards(createValidEnv(), {
        ...placeholderContext,
        scenarioCount: 2,
      }),
    ).toThrow(LiveTestGuardError);

    try {
      validateSafetyGuards(createValidEnv(), {
        ...placeholderContext,
        scenarioCount: 2,
      });
    } catch (error) {
      expect((error as LiveTestGuardError).code).toBe('BULK_LIVE_TESTS_NOT_ALLOWED');
    }
  });

  it('always refuses delete or cancel requests', () => {
    expect(() =>
      validateSafetyGuards(createValidEnv({ ALLOW_DELETE_OR_CANCEL: true }), {
        ...placeholderContext,
        requestsDeleteOrCancel: true,
      }),
    ).toThrow(LiveTestGuardError);

    expect(() => assertDeleteOrCancelForbidden()).toThrow(LiveTestGuardError);
  });
});

describe('collectSafetyChecks', () => {
  it('marks tier-2 checks as skipped for placeholder context', () => {
    const checks = collectSafetyChecks(createValidEnv(), placeholderContext);

    expect(
      checks.find((check) => check.code === 'LIVE_TEST_CONFIRM_REQUIRED')?.status,
    ).toBe('skipped');
    expect(
      checks.find((check) => check.code === 'TEST_DEAL_CREATION_REQUIRED')?.status,
    ).toBe('skipped');
  });
});
