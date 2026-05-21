import { FakturowniaErrorMapper } from './fakturownia-error.mapper';
import { FakturowniaApiError } from './fakturownia.errors';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaMapper } from './fakturownia.mapper';
import { FakturowniaService } from './fakturownia.service';
import {
  fakturowniaClientErrorBodyFixture,
  fakturowniaInvoiceRawSuccessFixture,
  fakturowniaServerErrorBodyFixture,
  invoiceDraftFullFixture,
} from './testing/fakturownia.fixtures';

describe('FakturowniaService', () => {
  const mapper = new FakturowniaMapper();
  const errorMapper = new FakturowniaErrorMapper();

  const createService = (client: Pick<FakturowniaClient, 'createInvoice'>) =>
    new FakturowniaService(
      client as FakturowniaClient,
      mapper,
      errorMapper,
    );

  it('creates invoice and maps successful response', async () => {
    const raw = fakturowniaInvoiceRawSuccessFixture();
    const client = {
      createInvoice: jest.fn().mockResolvedValue(raw),
    };

    const service = createService(client);
    const result = await service.createInvoice(invoiceDraftFullFixture());

    expect(client.createInvoice).toHaveBeenCalledTimes(1);
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

  it('maps 4xx client errors from the HTTP layer', async () => {
    const client = {
      createInvoice: jest.fn().mockRejectedValue({
        httpStatus: 422,
        body: fakturowniaClientErrorBodyFixture(),
      }),
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
    };

    const service = createService(client);

    await expect(service.createInvoice(invoiceDraftFullFixture())).rejects.toMatchObject({
      category: 'TIMEOUT',
    } satisfies Partial<FakturowniaApiError>);
  });

  it('maps unknown errors', async () => {
    const client = {
      createInvoice: jest.fn().mockRejectedValue(new Error('Unexpected failure')),
    };

    const service = createService(client);

    await expect(service.createInvoice(invoiceDraftFullFixture())).rejects.toMatchObject({
      category: 'UNKNOWN',
      message: 'Unexpected failure',
    } satisfies Partial<FakturowniaApiError>);
  });
});
