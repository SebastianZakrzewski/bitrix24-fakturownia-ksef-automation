import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AppEnv } from '../../../config/env.validation';
import { Bitrix24ApiError } from '../errors/bitrix24.errors';
import { BITRIX24_HTTP_CLIENT, type Bitrix24FetchFn } from './bitrix24-http-client.token';
import { Bitrix24Client } from './bitrix24.client';

describe('Bitrix24Client', () => {
  const webhookUrl = 'https://example.bitrix24.pl/rest/1/token';

  const createClient = async (
    fetchFn: Bitrix24FetchFn,
    config: Record<string, unknown> = { BITRIX24_WEBHOOK_URL: webhookUrl },
  ) => {
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService<AppEnv, true>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: BITRIX24_HTTP_CLIENT,
          useValue: fetchFn,
        },
        Bitrix24Client,
      ],
    }).compile();

    return moduleRef.get(Bitrix24Client);
  };

  it('returns result from a successful Bitrix envelope', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { ID: '42' } }),
    });

    const client = await createClient(fetchFn);
    const result = await client.call<{ ID: string }>(
      'DEAL_GET',
      'crm.deal.get',
      { id: '42' },
    );

    expect(result).toEqual({ ID: '42' });
    expect(fetchFn).toHaveBeenCalledWith(
      `${webhookUrl}/crm.deal.get.json`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: '42' }),
      }),
    );
  });

  it('throws Bitrix24ApiError when Bitrix returns error payload', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        error: 'INVALID_CREDENTIALS',
        error_description: 'Invalid webhook token',
      }),
    });

    const client = await createClient(fetchFn);

    await expect(
      client.call('DEAL_GET', 'crm.deal.get', { id: '42' }),
    ).rejects.toMatchObject({
      name: 'Bitrix24ApiError',
      operation: 'DEAL_GET',
      method: 'crm.deal.get',
      bitrixErrorCode: 'INVALID_CREDENTIALS',
    } satisfies Partial<Bitrix24ApiError>);
  });

  it('throws Bitrix24ApiError on non-2xx HTTP status', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'SERVICE_UNAVAILABLE' }),
    });

    const client = await createClient(fetchFn);

    await expect(client.call('DEAL_GET', 'crm.deal.get')).rejects.toMatchObject({
      operation: 'DEAL_GET',
      httpStatus: 503,
    });
  });

  it('throws when webhook URL is not configured', async () => {
    const fetchFn = jest.fn();
    const client = await createClient(fetchFn, {});

    await expect(client.call('DEAL_GET', 'crm.deal.get')).rejects.toThrow(
      'BITRIX24_WEBHOOK_URL is not configured',
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
