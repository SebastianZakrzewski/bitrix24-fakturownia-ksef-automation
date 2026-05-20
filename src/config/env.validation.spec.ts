import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts the required V1 skeleton environment variables', () => {
    const env = validateEnv({
      NODE_ENV: 'test',
      PORT: '3000',
      N8N_API_KEY: 'n8n-secret',
      ADMIN_API_KEY: 'admin-secret',
      PANEL_API_KEY: 'panel-secret',
    });

    expect(env).toEqual({
      NODE_ENV: 'test',
      PORT: 3000,
      N8N_API_KEY: 'n8n-secret',
      ADMIN_API_KEY: 'admin-secret',
      PANEL_API_KEY: 'panel-secret',
      DATABASE_SCHEMA: 'fakturownia-ksef-invoices',
    });
  });

  it('rejects missing API keys', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        PORT: '3000',
      }),
    ).toThrow('Invalid environment configuration');
  });
});
