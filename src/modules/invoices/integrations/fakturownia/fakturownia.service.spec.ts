import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import { FakturowniaErrorMapper } from './fakturownia-error.mapper';
import { FakturowniaApiError } from './fakturownia.errors';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaInvoiceNumberService } from './fakturownia-invoice-number.service';
import { FakturowniaMapper } from './fakturownia.mapper';
import { FakturowniaService } from './fakturownia.service';
import {
  fakturowniaClientErrorBodyFixture,
  fakturowniaInvoiceNumberAssignmentFixture,
  fakturowniaInvoiceOrderLinkageFixture,
  fakturowniaInvoiceRawSuccessFixture,
  fakturowniaServerErrorBodyFixture,
  invoiceDraftAdvanceFixture,
  invoiceDraftFullFixture,
  invoiceNumberFieldsFixture,
} from './testing/fakturownia.fixtures';

describe('FakturowniaService', () => {
  const mapper = new FakturowniaMapper();
  const errorMapper = new FakturowniaErrorMapper();

  const defaultPollConfig = {
    FAKTUROWNIA_KSEF_STATUS_POLL_TIMEOUT_MS: 60_000,
    FAKTUROWNIA_KSEF_STATUS_POLL_INTERVAL_MS: 5_000,
  };
  const numberAssignment = fakturowniaInvoiceNumberAssignmentFixture();
  const numberFields = invoiceNumberFieldsFixture();

  const createInvoiceNumberService = () => ({
    allocate: jest.fn().mockResolvedValue(numberAssignment),
  });

  const createService = (
    client: Pick<FakturowniaClient, 'createInvoice' | 'getInvoiceKsefStatus'>,
    config: Record<string, unknown> = defaultPollConfig,
    invoiceNumberService: Pick<FakturowniaInvoiceNumberService, 'allocate'> =
      createInvoiceNumberService(),
  ) =>
    new FakturowniaService(
      client as FakturowniaClient,
      mapper,
      errorMapper,
      invoiceNumberService as FakturowniaInvoiceNumberService,
      {
        get: (key: string) => config[key],
      } as unknown as ConfigService<AppEnv, true>,
    );

  it('passes order linkage to mapper for ADVANCE invoice', async () => {
    const raw = fakturowniaInvoiceRawSuccessFixture();
    const client = {
      createInvoice: jest.fn().mockResolvedValue(raw),
      getInvoiceKsefStatus: jest.fn(),
    };
    const orderLinkage = fakturowniaInvoiceOrderLinkageFixture();

    const service = createService(client);
    await service.createInvoice(invoiceDraftAdvanceFixture(), orderLinkage);

    expect(client.createInvoice).toHaveBeenCalledWith({
      kind: 'advance',
      ...numberFields,
      copy_invoice_from: 10042,
      advance_creation_mode: 'amount',
      advance_value: '3000',
      position_name: 'Zaliczka na wykonanie zamówienia ZAM/100/2026',
    });
    expect(client.getInvoiceKsefStatus).not.toHaveBeenCalled();
  });

  it('creates invoice with explicit number assignment and maps successful response', async () => {
    const raw = fakturowniaInvoiceRawSuccessFixture();
    const client = {
      createInvoice: jest.fn().mockResolvedValue(raw),
      getInvoiceKsefStatus: jest.fn(),
    };
    const invoiceNumberService = createInvoiceNumberService();

    const service = createService(client, defaultPollConfig, invoiceNumberService);
    const result = await service.createInvoice(invoiceDraftFullFixture());

    expect(invoiceNumberService.allocate).toHaveBeenCalledWith('FULL');
    expect(client.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining(numberFields),
    );
    expect(client.getInvoiceKsefStatus).not.toHaveBeenCalled();
    expect(result).toEqual({
      fakturowniaInvoiceId: '987654',
      fakturowniaInvoiceUrl:
        'https://evapremium.fakturownia.pl/invoices/987654',
      totalNet: 7747.97,
      totalGross: 9500,
      currency: 'PLN',
      ksefStatus: 'SUBMISSION_CONFIRMED',
      ksefRawStatus: 'ok',
    });
  });

  it('polls KSeF status when create returns null and resolves to ok', async () => {
    jest.useFakeTimers();

    const raw = fakturowniaInvoiceRawSuccessFixture({ gov_status: null });
    const client = {
      createInvoice: jest.fn().mockResolvedValue(raw),
      getInvoiceKsefStatus: jest
        .fn()
        .mockResolvedValueOnce({ gov_status: null, gov_id: null })
        .mockResolvedValueOnce({
          gov_status: 'ok',
          gov_id: '5871715880-20260529-11B877400000-69',
        }),
    };

    const service = createService(client);
    const resultPromise = service.createInvoice(invoiceDraftFullFixture());

    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(client.getInvoiceKsefStatus).toHaveBeenCalledTimes(2);
    expect(client.getInvoiceKsefStatus).toHaveBeenCalledWith('987654');
    expect(result.ksefStatus).toBe('SUBMISSION_CONFIRMED');
    expect(result.ksefRawStatus).toBe('ok');

    jest.useRealTimers();
  });

  it('polls KSeF status when create returns processing and resolves to ok', async () => {
    jest.useFakeTimers();

    const raw = fakturowniaInvoiceRawSuccessFixture({ gov_status: 'processing' });
    const client = {
      createInvoice: jest.fn().mockResolvedValue(raw),
      getInvoiceKsefStatus: jest
        .fn()
        .mockResolvedValueOnce({ gov_status: 'processing', gov_id: null })
        .mockResolvedValueOnce({ gov_status: 'ok', gov_id: '5252445767-20260201-ABC123' }),
    };

    const service = createService(client);
    const resultPromise = service.createInvoice(invoiceDraftFullFixture());

    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(client.getInvoiceKsefStatus).toHaveBeenCalledTimes(2);
    expect(client.getInvoiceKsefStatus).toHaveBeenCalledWith('987654');
    expect(result.ksefStatus).toBe('SUBMISSION_CONFIRMED');
    expect(result.ksefRawStatus).toBe('ok');

    jest.useRealTimers();
  });

  it('returns STATUS_UNKNOWN when KSeF status stays processing for the poll budget', async () => {
    jest.useFakeTimers();

    const raw = fakturowniaInvoiceRawSuccessFixture({ gov_status: 'processing' });
    const client = {
      createInvoice: jest.fn().mockResolvedValue(raw),
      getInvoiceKsefStatus: jest
        .fn()
        .mockResolvedValue({ gov_status: 'processing', gov_id: null }),
    };

    const service = createService(client, {
      FAKTUROWNIA_KSEF_STATUS_POLL_TIMEOUT_MS: 12_000,
      FAKTUROWNIA_KSEF_STATUS_POLL_INTERVAL_MS: 5_000,
    });
    const resultPromise = service.createInvoice(invoiceDraftFullFixture());

    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(client.getInvoiceKsefStatus).toHaveBeenCalledTimes(3);
    expect(result.ksefStatus).toBe('STATUS_UNKNOWN');
    expect(result.ksefRawStatus).toBe('processing');

    jest.useRealTimers();
  });

  it('maps terminal KSeF error returned during polling', async () => {
    jest.useFakeTimers();

    const raw = fakturowniaInvoiceRawSuccessFixture({ gov_status: 'processing' });
    const client = {
      createInvoice: jest.fn().mockResolvedValue(raw),
      getInvoiceKsefStatus: jest
        .fn()
        .mockResolvedValue({ gov_status: 'send_error', gov_id: null }),
    };

    const service = createService(client);
    const resultPromise = service.createInvoice(invoiceDraftFullFixture());

    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.ksefStatus).toBe('SUBMISSION_ERROR');
    expect(result.ksefRawStatus).toBe('send_error');

    jest.useRealTimers();
  });

  it('maps 4xx client errors from the HTTP layer', async () => {
    const client = {
      createInvoice: jest.fn().mockRejectedValue({
        httpStatus: 422,
        body: fakturowniaClientErrorBodyFixture(),
      }),
      getInvoiceKsefStatus: jest.fn(),
    };

    const service = createService(client);

    await expect(service.createInvoice(invoiceDraftFullFixture())).rejects.toMatchObject({
      name: 'FakturowniaApiError',
      category: 'CLIENT',
      httpStatus: 422,
    } satisfies Partial<FakturowniaApiError>);
  });

  it('maps 5xx server errors from the HTTP layer', async () => {
    const client = {
      createInvoice: jest.fn().mockRejectedValue({
        httpStatus: 503,
        body: fakturowniaServerErrorBodyFixture(),
      }),
      getInvoiceKsefStatus: jest.fn(),
    };

    const service = createService(client);

    await expect(service.createInvoice(invoiceDraftFullFixture())).rejects.toMatchObject({
      category: 'SERVER',
      httpStatus: 503,
    } satisfies Partial<FakturowniaApiError>);
  });

  it('maps timeout errors', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'AbortError';

    const client = {
      createInvoice: jest.fn().mockRejectedValue(timeoutError),
      getInvoiceKsefStatus: jest.fn(),
    };

    const service = createService(client);

    await expect(service.createInvoice(invoiceDraftFullFixture())).rejects.toMatchObject({
      category: 'TIMEOUT',
    } satisfies Partial<FakturowniaApiError>);
  });

  it('maps unknown errors', async () => {
    const client = {
      createInvoice: jest.fn().mockRejectedValue(new Error('Unexpected failure')),
      getInvoiceKsefStatus: jest.fn(),
    };

    const service = createService(client);

    await expect(service.createInvoice(invoiceDraftFullFixture())).rejects.toMatchObject({
      category: 'UNKNOWN',
      message: 'Unexpected failure',
    } satisfies Partial<FakturowniaApiError>);
  });
});
