import type { InvoiceType } from '../../types/invoice.types';

export type FakturowniaInvoiceKind = 'vat' | 'advance' | 'final';

const INVOICE_NUMBER_PATTERN = /^(\d+)\/(\d{2})[./](\d{4})$/;
const ADVANCE_PREFIX_NUMBER_PATTERN = /^Z(\d+)$/i;
const FINAL_PREFIX_NUMBER_PATTERN = /^ZK(\d+)$/i;

export function mapInvoiceTypeToFakturowniaKind(
  invoiceType: InvoiceType,
): FakturowniaInvoiceKind {
  switch (invoiceType) {
    case 'FULL':
      return 'vat';
    case 'ADVANCE':
      return 'advance';
    case 'FINAL':
      return 'final';
  }
}

export function yearMonthToMonthPeriod(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');

  if (!year || !month) {
    throw new Error(`Invalid year-month value: ${yearMonth}`);
  }

  return `${month}.${year}`;
}

export function formatInvoiceNumber(
  sequence: number,
  yearMonth: string,
): string {
  const [year, month] = yearMonth.split('-');

  if (!year || !month) {
    throw new Error(`Invalid year-month value: ${yearMonth}`);
  }

  return `${sequence}/${month}/${year}`;
}

export function monthPeriodToSlashForm(monthPeriod: string): string {
  return monthPeriod.replace('.', '/');
}

export function parseInvoiceNumberSequence(
  number: string | null | undefined,
  expectedMonthPeriod: string,
): number | null {
  if (!number) {
    return null;
  }

  const match = INVOICE_NUMBER_PATTERN.exec(number.trim());

  if (!match) {
    return null;
  }

  const month = match[2]!;
  const year = match[3]!;
  const actualDotPeriod = `${month}.${year}`;
  const actualSlashPeriod = `${month}/${year}`;
  const expectedSlashPeriod = monthPeriodToSlashForm(expectedMonthPeriod);

  if (
    actualDotPeriod !== expectedMonthPeriod &&
    actualSlashPeriod !== expectedSlashPeriod
  ) {
    return null;
  }

  const sequence = Number.parseInt(match[1]!, 10);

  return Number.isNaN(sequence) ? null : sequence;
}

export function parseAdvancePrefixedSequence(
  number: string | null | undefined,
): number | null {
  if (!number) {
    return null;
  }

  const match = ADVANCE_PREFIX_NUMBER_PATTERN.exec(number.trim());

  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1]!, 10);

  return Number.isNaN(sequence) ? null : sequence;
}

export function parseFinalPrefixedSequence(
  number: string | null | undefined,
): number | null {
  if (!number) {
    return null;
  }

  const match = FINAL_PREFIX_NUMBER_PATTERN.exec(number.trim());

  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1]!, 10);

  return Number.isNaN(sequence) ? null : sequence;
}

function extractInvoiceNumberSequence(
  number: string | null | undefined,
  monthPeriod: string,
): number | null {
  return parseInvoiceNumberSequence(number, monthPeriod);
}

export function maxInvoiceNumberSequence(
  numbers: Array<string | null | undefined>,
  yearMonth: string,
  invoiceType: InvoiceType,
): number {
  const monthPeriod = yearMonthToMonthPeriod(yearMonth);

  if (invoiceType === 'FULL') {
    return numbers.reduce((max, number) => {
      const sequence = extractInvoiceNumberSequence(number, monthPeriod);

      if (sequence === null) {
        return max;
      }

      return Math.max(max, sequence);
    }, 0);
  }

  let numericMax = 0;
  let prefixedCount = 0;

  for (const number of numbers) {
    const standardSequence = extractInvoiceNumberSequence(number, monthPeriod);

    if (standardSequence !== null) {
      numericMax = Math.max(numericMax, standardSequence);
      continue;
    }

    if (invoiceType === 'ADVANCE' && parseAdvancePrefixedSequence(number) !== null) {
      prefixedCount += 1;
      continue;
    }

    if (invoiceType === 'FINAL' && parseFinalPrefixedSequence(number) !== null) {
      prefixedCount += 1;
    }
  }

  return numericMax + prefixedCount;
}

export function resolveNextInvoiceSequence(options: {
  apiMaxSequence: number;
  bootstrapNext?: number;
  isBootstrapMonth: boolean;
}): number {
  const floor =
    options.isBootstrapMonth && options.bootstrapNext !== undefined
      ? options.bootstrapNext
      : 1;

  return Math.max(options.apiMaxSequence + 1, floor);
}

export function getWarsawDateParts(date: Date): {
  isoDate: string;
  yearMonth: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to resolve Warsaw calendar date');
  }

  return {
    isoDate: `${year}-${month}-${day}`,
    yearMonth: `${year}-${month}`,
  };
}
