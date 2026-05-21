import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import { FakturowniaApiError } from './fakturownia.errors';
import { FakturowniaClient } from './fakturownia.client';
import {
  fakturowniaClientErrorBodyFixture,
  fakturowniaInvoiceRawSuccessFixture,
  invoiceDraftFullFixture,
} from './testing/fakturownia.fixtures';
import { FakturowniaMapper } from './fakturownia.mapper';

describe('FakturowniaClient', () => {
  const baseUrl = 'https://evapremium.fakturownia.pl';
  const apiToken = 'test-api-token';

  const createClient = (
    fetchFn: typeof fetch,
    config: Record<string, unknown> = {
      FAKTUROWNIA_BASE_URL: baseUrl,
      FAKTUROWNIA_API_TOKEN: apiToken,
      FAKTUROWNIA_REQUEST_TIMEOUT_MS: 30000,
    },
  ) => {
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService<AppEnv, true>;

    return new FakturowniaClient(configService, fetchFn);
  };

  it('posts invoice payload to Fakturownia API', async () => {
    const raw = fakturowniaInvoiceRawSuccessFixture();
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => raw,
    });

    const client = createClient(fetchFn);
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(invoiceDraftFullFixture());

    const result = await client.createInvoice(payload);

    expect(result).toEqual(raw);
    expect(fetchFn).toHaveBeenCalledWith(
      `${baseUrl}/invoices.json`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_token: apiToken,
          invoice: payload,
        }),
      }),
    );
  });

  it('throws HTTP failure object on non-2xx response', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => fakturowniaClientErrorBodyFixture(),
    });

    const client = createClient(fetchFn);
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(invoiceDraftFullFixture());

    await expect(client.createInvoice(payload)).rejects.toEqual({
      httpStatus: 422,
      body: fakturowniaClientErrorBodyFixture(),
    });
  });

  it('throws when FAKTUROWNIA_BASE_URL is not configured', async () => {
    const client = createClient(jest.fn(), {
      FAKTUROWNIA_API_TOKEN: apiToken,
      FAKTUROWNIA_REQUEST_TIMEOUT_MS: 30000,
    });
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(invoiceDraftFullFixture());

    await expect(client.createInvoice(payload)).rejects.toMatchObject({
      name: 'FakturowniaApiError',
      category: 'UNKNOWN',
      message: 'FAKTUROWNIA_BASE_URL is not configured',
    } satisfies Partial<FakturowniaApiError>);
  });

  it('propagates fetch timeout failures', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'AbortError';
    const fetchFn = jest.fn().mockRejectedValue(timeoutError);

    const client = createClient(fetchFn);
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(invoiceDraftFullFixture());

    await expect(client.createInvoice(payload)).rejects.toThrow('The operation was aborted');
  });
});
