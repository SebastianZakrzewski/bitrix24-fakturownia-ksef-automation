import { parseBackendTriggerExecutionConfig } from './trigger-execution/backend-trigger-execution-config';
import { resolveBackendAuthSecret } from './resolve-backend-auth-secret';

describe('resolveBackendAuthSecret', () => {
  it('prefers LIVE_TEST_BACKEND_AUTH_SECRET when set', () => {
    expect(
      resolveBackendAuthSecret({
        LIVE_TEST_BACKEND_AUTH_SECRET: 'explicit-secret',
        N8N_API_KEY: 'n8n-secret',
      }),
    ).toBe('explicit-secret');
  });

  it('falls back to N8N_API_KEY when live-test secret is unset', () => {
    expect(
      resolveBackendAuthSecret({
        N8N_API_KEY: 'n8n-secret',
      }),
    ).toBe('n8n-secret');
  });

  it('wires fallback into trigger execution config parser', () => {
    const config = parseBackendTriggerExecutionConfig({
      LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
      N8N_API_KEY: 'n8n-secret',
    });

    expect(config.authSecret).toBe('n8n-secret');
  });
});
