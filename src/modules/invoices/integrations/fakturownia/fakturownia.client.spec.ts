import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AppEnv } from '../../../../config/env.validation';
import { FakturowniaApiError } from './fakturownia.errors';
import { FakturowniaClient } from './fakturownia.client';
import {
  FAKTUROWNIA_HTTP_CLIENT,
  type FakturowniaFetchFn,
} from './fakturownia-http-client.token';
import {
  fakturowniaClientErrorBodyFixture,
  fakturowniaInvoiceNumberAssignmentFixture,
  fakturowniaInvoiceRawSuccessFixture,
  fakturowniaOrderRawSuccessFixture,
  invoiceDraftAdvanceFixture,
  invoiceDraftFullFixture,
} from './testing/fakturownia.fixtures';
import { FakturowniaMapper } from './fakturownia.mapper';
import { FakturowniaOrderMapper } from './fakturownia-order.mapper';

describe('FakturowniaClient', () => {
  const baseUrl = 'https://evapremium.fakturownia.pl';
  const apiToken = 'test-api-token';
  const numberAssignment = fakturowniaInvoiceNumberAssignmentFixture();

  const createClient = async (
    fetchFn: FakturowniaFetchFn,
    config: Record<string, unknown> = {
      FAKTUROWNIA_BASE_URL: baseUrl,
      FAKTUROWNIA_API_TOKEN: apiToken,
      FAKTUROWNIA_REQUEST_TIMEOUT_MS: 30000,
    },
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
          provide: FAKTUROWNIA_HTTP_CLIENT,
          useValue: fetchFn,
        },
        FakturowniaClient,
      ],
    }).compile();

    return moduleRef.get(FakturowniaClient);
  };

  it('posts invoice payload to Fakturownia API', async () => {
    const raw = fakturowniaInvoiceRawSuccessFixture();
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => raw,
    });

    const client = await createClient(fetchFn);
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(
      invoiceDraftFullFixture(),
      numberAssignment,
    );

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

    const client = await createClient(fetchFn);
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(
      invoiceDraftFullFixture(),
      numberAssignment,
    );

    await expect(client.createInvoice(payload)).rejects.toEqual({
      httpStatus: 422,
      body: fakturowniaClientErrorBodyFixture(),
    });
  });

  it('throws when FAKTUROWNIA_BASE_URL is not configured', async () => {
    const client = await createClient(jest.fn(), {
      FAKTUROWNIA_API_TOKEN: apiToken,
      FAKTUROWNIA_REQUEST_TIMEOUT_MS: 30000,
    });
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(
      invoiceDraftFullFixture(),
      numberAssignment,
    );

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

    const client = await createClient(fetchFn);
    const mapper = new FakturowniaMapper();
    const payload = mapper.toCreatePayload(
      invoiceDraftFullFixture(),
      numberAssignment,
    );

    await expect(client.createInvoice(payload)).rejects.toThrow('The operation was aborted');
  });

  it('posts order payload to Fakturownia API', async () => {
    const raw = fakturowniaOrderRawSuccessFixture();
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => raw,
    });

    const client = await createClient(fetchFn);
    const orderMapper = new FakturowniaOrderMapper();
    const payload = orderMapper.toCreatePayload(invoiceDraftAdvanceFixture());

    const result = await client.createOrder(payload);

    expect(result).toEqual(raw);
    expect(fetchFn).toHaveBeenCalledWith(
      `${baseUrl}/invoices.json`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          api_token: apiToken,
          invoice: payload,
        }),
      }),
    );
  });

  it('throws HTTP failure object on createOrder non-2xx response', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => fakturowniaClientErrorBodyFixture(),
    });

    const client = await createClient(fetchFn);
    const orderMapper = new FakturowniaOrderMapper();
    const payload = orderMapper.toCreatePayload(invoiceDraftAdvanceFixture());

    await expect(client.createOrder(payload)).rejects.toEqual({
      httpStatus: 422,
      body: fakturowniaClientErrorBodyFixture(),
    });
  });

  it('throws when FAKTUROWNIA_BASE_URL is not configured for createOrder', async () => {
    const client = await createClient(jest.fn(), {
      FAKTUROWNIA_API_TOKEN: apiToken,
      FAKTUROWNIA_REQUEST_TIMEOUT_MS: 30000,
    });
    const orderMapper = new FakturowniaOrderMapper();
    const payload = orderMapper.toCreatePayload(invoiceDraftAdvanceFixture());

    await expect(client.createOrder(payload)).rejects.toMatchObject({
      name: 'FakturowniaApiError',
      category: 'UNKNOWN',
      message: 'FAKTUROWNIA_BASE_URL is not configured',
    } satisfies Partial<FakturowniaApiError>);
  });

  it('propagates fetch timeout failures on createOrder', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'AbortError';
    const fetchFn = jest.fn().mockRejectedValue(timeoutError);

    const client = await createClient(fetchFn);
    const orderMapper = new FakturowniaOrderMapper();
    const payload = orderMapper.toCreatePayload(invoiceDraftAdvanceFixture());

    await expect(client.createOrder(payload)).rejects.toThrow('The operation was aborted');
  });

  it('lists invoices for issue month and filters by issue_date prefix', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { number: '38/05.2026', issue_date: '2026-05-29', kind: 'vat' },
          { number: '1/04.2026', issue_date: '2026-04-30', kind: 'vat' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

    const client = await createClient(fetchFn);
    const result = await client.listInvoicesForIssueMonth('vat', '2026-05');

    expect(result).toEqual([
      { number: '38/05.2026', issue_date: '2026-05-29', kind: 'vat' },
    ]);
    expect(fetchFn).toHaveBeenCalledWith(
      `${baseUrl}/invoices.json?api_token=${apiToken}&kind=vat&per_page=100&page=1`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('gets invoice KSeF status from Fakturownia API', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        gov_status: 'ok',
        gov_id: '5252445767-20260201-ABC123',
      }),
    });

    const client = await createClient(fetchFn);
    const result = await client.getInvoiceKsefStatus('987654');

    expect(result).toEqual({
      gov_status: 'ok',
      gov_id: '5252445767-20260201-ABC123',
    });
    expect(fetchFn).toHaveBeenCalledWith(
      `${baseUrl}/invoices/987654.json?api_token=${apiToken}&fields%5Binvoice%5D=gov_status%2Cgov_id`,
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }),
    );
  });

  it('downloads invoice PDF from Fakturownia API', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4 test');
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => pdfBytes,
    });

    const client = await createClient(fetchFn);
    const result = await client.downloadInvoicePdf('987654');

    expect(result.equals(pdfBytes)).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(
      `${baseUrl}/invoices/987654.pdf?api_token=${apiToken}`,
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/pdf',
        },
      }),
    );
  });

  it('throws HTTP failure object on downloadInvoicePdf non-2xx response', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' }),
    });

    const client = await createClient(fetchFn);

    await expect(client.downloadInvoicePdf('987654')).rejects.toEqual({
      httpStatus: 404,
      body: { message: 'Not found' },
    });
  });
});
