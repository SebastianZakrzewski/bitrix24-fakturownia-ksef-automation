import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import type { InvoiceType } from '../../types/invoice.types';
import { FakturowniaClient } from './fakturownia.client';
import {
  formatInvoiceNumber,
  getWarsawDateParts,
  mapInvoiceTypeToFakturowniaKind,
  maxInvoiceNumberSequence,
  resolveNextInvoiceSequence,
} from './fakturownia-invoice-number.util';
import type { FakturowniaInvoiceNumberAssignment } from './fakturownia.types';

@Injectable()
export class FakturowniaInvoiceNumberService {
  constructor(
    private readonly client: FakturowniaClient,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async allocate(
    invoiceType: InvoiceType,
    referenceDate: Date = new Date(),
  ): Promise<FakturowniaInvoiceNumberAssignment> {
    const { isoDate, yearMonth } = getWarsawDateParts(referenceDate);
    const kind = mapInvoiceTypeToFakturowniaKind(invoiceType);
    const invoices = await this.client.listInvoicesForIssueMonth(kind, yearMonth);
    const apiMaxSequence = maxInvoiceNumberSequence(
      invoices.map((invoice) => invoice.number),
      yearMonth,
      invoiceType,
    );
    const bootstrapMonth = this.configService.get(
      'FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH',
      { infer: true },
    );
    const isBootstrapMonth = bootstrapMonth === yearMonth;
    const bootstrapNext = this.getBootstrapNext(invoiceType);
    const nextSequence = resolveNextInvoiceSequence({
      apiMaxSequence,
      bootstrapNext,
      isBootstrapMonth,
    });

    return {
      number: formatInvoiceNumber(nextSequence, yearMonth, invoiceType),
      issueDate: isoDate,
      sellDate: isoDate,
    };
  }

  private getBootstrapNext(invoiceType: InvoiceType): number | undefined {
    switch (invoiceType) {
      case 'FULL':
        return this.configService.get(
          'FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FULL',
          { infer: true },
        );
      case 'ADVANCE':
        return this.configService.get(
          'FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_ADVANCE',
          { infer: true },
        );
      case 'FINAL':
        return this.configService.get(
          'FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FINAL',
          { infer: true },
        );
    }
  }
}
