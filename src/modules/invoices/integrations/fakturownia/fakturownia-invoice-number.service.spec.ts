import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaInvoiceNumberService } from './fakturownia-invoice-number.service';
import { invoiceNumberFormatsAreDistinct } from './fakturownia-invoice-number.util';

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

  it('allocates next ADVANCE number with Z prefix including legacy invoices', async () => {
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
      expect.objectContaining({ number: 'Z28/05/2026' }),
    );
  });

  it('allocates next FINAL number with ZK prefix including legacy invoices', async () => {
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
      expect.objectContaining({ number: 'ZK35/05/2026' }),
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

  it('allocates bootstrap ADVANCE number above API max with Z prefix', async () => {
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
      expect.objectContaining({ number: 'Z28/05/2026' }),
    );
  });

  it('allocates bootstrap FINAL number above API max with ZK prefix', async () => {
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
      expect.objectContaining({ number: 'ZK35/05/2026' }),
    );
  });

  it('resets to prefixed 1 outside bootstrap month', async () => {
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
    await expect(service.allocate('ADVANCE', juneDate)).resolves.toEqual(
      expect.objectContaining({ number: 'Z1/06/2026' }),
    );
    await expect(service.allocate('FINAL', juneDate)).resolves.toEqual(
      expect.objectContaining({ number: 'ZK1/06/2026' }),
    );
  });

  it('never allocates identical numbers across invoice types in the same month', async () => {
    const juneDate = new Date('2026-06-08T23:19:34.000+02:00');
    const responses: Record<'vat' | 'advance' | 'final', Array<{ number: string; issue_date: string }>> = {
      vat: [],
      advance: [{ number: '1/06/2026', issue_date: '2026-06-01' }],
      final: [],
    };

    const client = {
      listInvoicesForIssueMonth: jest.fn(
        async (kind: 'vat' | 'advance' | 'final') => responses[kind],
      ),
    };

    const service = createService(client);
    const allocated: string[] = [];

    for (const invoiceType of ['FULL', 'ADVANCE', 'FINAL'] as const) {
      const assignment = await service.allocate(invoiceType, juneDate);
      allocated.push(assignment.number);
      expect(invoiceNumberFormatsAreDistinct(1, '2026-06')).toBe(true);
    }

    expect(new Set(allocated).size).toBe(allocated.length);
    expect(allocated).toEqual(['1/06/2026', 'Z2/06/2026', 'ZK1/06/2026']);
  });
});
