import { parseLiveTestEnv } from './live-test-env';

describe('parseLiveTestEnv', () => {
  it('parses boolean flags strictly as true only', () => {
    const env = parseLiveTestEnv({
      LIVE_TEST_MODE: 'true',
      LIVE_TEST_CONFIRM: 'false',
      ENABLE_EXTERNAL_SIDE_EFFECTS: '1',
      ALLOW_TEST_DEAL_CREATION: 'yes',
      TEST_DEAL_PREFIX: '[TEST]',
      ALLOW_BULK_LIVE_TESTS: 'false',
      ALLOW_DELETE_OR_CANCEL: 'false',
    });

    expect(env.LIVE_TEST_MODE).toBe(true);
    expect(env.LIVE_TEST_CONFIRM).toBe(false);
    expect(env.ENABLE_EXTERNAL_SIDE_EFFECTS).toBe(false);
    expect(env.ALLOW_TEST_DEAL_CREATION).toBe(false);
  });

  it('rejects missing TEST_DEAL_PREFIX', () => {
    expect(() =>
      parseLiveTestEnv({
        LIVE_TEST_MODE: 'true',
        TEST_DEAL_PREFIX: '',
      }),
    ).toThrow('Invalid live-test environment');
  });
});
