import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaInvoiceNumberService } from './fakturownia-invoice-number.service';

describe('FakturowniaInvoiceNumberService', () => {
  const referenceDate = new Date('2026-05-29T12:00:00.000Z');

  const createService = (
    client: Pick<FakturowniaClient, 'listInvoicesForIssueMonth'>,
    config: Record<string, unknown> = {},
  ) =>
    new FakturowniaInvoiceNumberService(
      client as FakturowniaClient,
      {
        get: (key: string) => config[key],
      } as unknown as ConfigService<AppEnv, true>,
    );

  it('allocates next FULL number from slash-format API invoices without bootstrap', async () => {
    const client = {
      listInvoicesForIssueMonth: jest
        .fn()
        .mockResolvedValue([
          { number: '37/05/2026', issue_date: '2026-05-29' },
          { number: '38/05/2026', issue_date: '2026-05-29' },
        ]),
    };

    const service = createService(client);

    await expect(service.allocate('FULL', referenceDate)).resolves.toEqual({
      number: '39/05/2026',
      issueDate: '2026-05-29',
      sellDate: '2026-05-29',
    });
  });

  it('allocates next ADVANCE number including Z-prefixed invoices', async () => {
    const client = {
      listInvoicesForIssueMonth: jest
        .fn()
        .mockResolvedValue([
          { number: '26/05/2026', issue_date: '2026-05-19' },
          { number: 'Z1', issue_date: '2026-05-29' },
        ]),
    };

    const service = createService(client);

    await expect(service.allocate('ADVANCE', referenceDate)).resolves.toEqual(
      expect.objectContaining({ number: '28/05/2026' }),
    );
  });

  it('allocates next FINAL number including ZK-prefixed invoices', async () => {
    const client = {
      listInvoicesForIssueMonth: jest
        .fn()
        .mockResolvedValue([
          { number: '33/05/2026', issue_date: '2026-05-21' },
          { number: 'ZK1', issue_date: '2026-05-29' },
        ]),
    };

    const service = createService(client);

    await expect(service.allocate('FINAL', referenceDate)).resolves.toEqual(
      expect.objectContaining({ number: '35/05/2026' }),
    );
  });

  it('allocates bootstrap FULL number when API max is lower', async () => {
    const client = {
      listInvoicesForIssueMonth: jest
        .fn()
        .mockResolvedValue([{ number: '38/05.2026', issue_date: '2026-05-29' }]),
    };

    const service = createService(client, {
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH: '2026-05',
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FULL: 39,
    });

    await expect(service.allocate('FULL', referenceDate)).resolves.toEqual({
      number: '39/05/2026',
      issueDate: '2026-05-29',
      sellDate: '2026-05-29',
    });
    expect(client.listInvoicesForIssueMonth).toHaveBeenCalledWith(
      'vat',
      '2026-05',
    );
  });

  it('allocates bootstrap ADVANCE number above API max', async () => {
    const client = {
      listInvoicesForIssueMonth: jest
        .fn()
        .mockResolvedValue([{ number: '26/05/2026', issue_date: '2026-05-19' }]),
    };

    const service = createService(client, {
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH: '2026-05',
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_ADVANCE: 28,
    });

    await expect(service.allocate('ADVANCE', referenceDate)).resolves.toEqual(
      expect.objectContaining({ number: '28/05/2026' }),
    );
  });

  it('allocates bootstrap FINAL number above API max', async () => {
    const client = {
      listInvoicesForIssueMonth: jest
        .fn()
        .mockResolvedValue([{ number: '33/05/2026', issue_date: '2026-05-21' }]),
    };

    const service = createService(client, {
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH: '2026-05',
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FINAL: 35,
    });

    await expect(service.allocate('FINAL', referenceDate)).resolves.toEqual(
      expect.objectContaining({ number: '35/05/2026' }),
    );
  });

  it('resets to 1 outside bootstrap month', async () => {
    const client = {
      listInvoicesForIssueMonth: jest.fn().mockResolvedValue([]),
    };

    const service = createService(client, {
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH: '2026-05',
      FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FULL: 39,
    });

    const juneDate = new Date('2026-06-01T10:00:00.000Z');

    await expect(service.allocate('FULL', juneDate)).resolves.toEqual(
      expect.objectContaining({ number: '1/06/2026' }),
    );
  });
});
