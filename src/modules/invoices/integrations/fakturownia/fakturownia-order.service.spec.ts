import { FakturowniaErrorMapper } from './fakturownia-error.mapper';
import { FakturowniaApiError } from './fakturownia.errors';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaOrderMapper } from './fakturownia-order.mapper';
import { FakturowniaOrderService } from './fakturownia-order.service';
import {
  fakturowniaClientErrorBodyFixture,
  fakturowniaOrderRawSuccessFixture,
  fakturowniaServerErrorBodyFixture,
  invoiceDraftAdvanceFixture,
} from './testing/fakturownia.fixtures';

describe('FakturowniaOrderService', () => {
  const orderMapper = new FakturowniaOrderMapper();
  const errorMapper = new FakturowniaErrorMapper();

  const createService = (client: Pick<FakturowniaClient, 'createOrder'>) =>
    new FakturowniaOrderService(
      client as FakturowniaClient,
      orderMapper,
      errorMapper,
    );

  it('creates order and maps successful response', async () => {
    const raw = fakturowniaOrderRawSuccessFixture();
    const client = {
      createOrder: jest.fn().mockResolvedValue(raw),
    };

    const service = createService(client);
    const result = await service.createOrder(invoiceDraftAdvanceFixture());

    expect(client.createOrder).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      fakturowniaOrderId: '10042',
      fakturowniaOrderNumber: 'ZAM/100/2026',
    });
  });

  it('maps 4xx client errors from the HTTP layer', async () => {
    const client = {
      createOrder: jest.fn().mockRejectedValue({
        httpStatus: 422,
        body: fakturowniaClientErrorBodyFixture(),
      }),
    };

    const service = createService(client);

    await expect(service.createOrder(invoiceDraftAdvanceFixture())).rejects.toMatchObject({
      name: 'FakturowniaApiError',
      category: 'CLIENT',
      httpStatus: 422,
    } satisfies Partial<FakturowniaApiError>);
  });

  it('maps 5xx server errors from the HTTP layer', async () => {
    const client = {
      createOrder: jest.fn().mockRejectedValue({
        httpStatus: 503,
        body: fakturowniaServerErrorBodyFixture(),
      }),
    };

    const service = createService(client);

    await expect(service.createOrder(invoiceDraftAdvanceFixture())).rejects.toMatchObject({
      category: 'SERVER',
      httpStatus: 503,
    } satisfies Partial<FakturowniaApiError>);
  });

  it('maps timeout errors', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'AbortError';

    const client = {
      createOrder: jest.fn().mockRejectedValue(timeoutError),
    };

    const service = createService(client);

    await expect(service.createOrder(invoiceDraftAdvanceFixture())).rejects.toMatchObject({
      category: 'TIMEOUT',
    } satisfies Partial<FakturowniaApiError>);
  });

  it('maps unknown errors', async () => {
    const client = {
      createOrder: jest.fn().mockRejectedValue(new Error('Unexpected failure')),
    };

    const service = createService(client);

    await expect(service.createOrder(invoiceDraftAdvanceFixture())).rejects.toMatchObject({
      category: 'UNKNOWN',
      message: 'Unexpected failure',
    } satisfies Partial<FakturowniaApiError>);
  });
});
