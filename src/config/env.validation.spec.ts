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
      FAKTUROWNIA_REQUEST_TIMEOUT_MS: 30000,
      N8N_INVOICE_EMAIL_WEBHOOK_TIMEOUT_MS: 30000,
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

  it('requires BITRIX24_WEBHOOK_URL outside test environment', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
        N8N_API_KEY: 'n8n-secret',
        ADMIN_API_KEY: 'admin-secret',
        PANEL_API_KEY: 'panel-secret',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postsale_agent',
      }),
    ).toThrow('BITRIX24_WEBHOOK_URL is required when NODE_ENV is not test');
  });

  it('requires Fakturownia config outside test environment', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        PORT: '3000',
        N8N_API_KEY: 'n8n-secret',
        ADMIN_API_KEY: 'admin-secret',
        PANEL_API_KEY: 'panel-secret',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postsale_agent',
        BITRIX24_WEBHOOK_URL: 'https://example.bitrix24.pl/rest/1/token',
      }),
    ).toThrow('FAKTUROWNIA_BASE_URL is required when NODE_ENV is not test');
  });
});
