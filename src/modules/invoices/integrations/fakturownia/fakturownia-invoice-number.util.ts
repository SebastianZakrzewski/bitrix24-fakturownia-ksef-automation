import type { InvoiceType } from '../../types/invoice.types';

export type FakturowniaInvoiceKind = 'vat' | 'advance' | 'final';

const FULL_INVOICE_NUMBER_PATTERN = /^(\d+)\/(\d{2})[./](\d{4})$/;
const ADVANCE_DATED_NUMBER_PATTERN = /^Z(\d+)\/(\d{2})[./](\d{4})$/i;
const FINAL_DATED_NUMBER_PATTERN = /^ZK(\d+)\/(\d{2})[./](\d{4})$/i;
const ADVANCE_LEGACY_PREFIX_NUMBER_PATTERN = /^Z(\d+)$/i;
const FINAL_LEGACY_PREFIX_NUMBER_PATTERN = /^ZK(\d+)$/i;

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
  invoiceType: InvoiceType,
): string {
  const [year, month] = yearMonth.split('-');

  if (!year || !month) {
    throw new Error(`Invalid year-month value: ${yearMonth}`);
  }

  const datedSuffix = `${sequence}/${month}/${year}`;

  switch (invoiceType) {
    case 'FULL':
      return datedSuffix;
    case 'ADVANCE':
      return `Z${datedSuffix}`;
    case 'FINAL':
      return `ZK${datedSuffix}`;
  }
}

export function monthPeriodToSlashForm(monthPeriod: string): string {
  return monthPeriod.replace('.', '/');
}

function matchesMonthPeriod(
  month: string,
  year: string,
  expectedMonthPeriod: string,
): boolean {
  const actualDotPeriod = `${month}.${year}`;
  const actualSlashPeriod = `${month}/${year}`;
  const expectedSlashPeriod = monthPeriodToSlashForm(expectedMonthPeriod);

  return (
    actualDotPeriod === expectedMonthPeriod ||
    actualSlashPeriod === expectedSlashPeriod
  );
}

export function parseInvoiceNumberSequence(
  number: string | null | undefined,
  expectedMonthPeriod: string,
): number | null {
  if (!number) {
    return null;
  }

  const match = FULL_INVOICE_NUMBER_PATTERN.exec(number.trim());

  if (!match) {
    return null;
  }

  const month = match[2]!;
  const year = match[3]!;

  if (!matchesMonthPeriod(month, year, expectedMonthPeriod)) {
    return null;
  }

  const sequence = Number.parseInt(match[1]!, 10);

  return Number.isNaN(sequence) ? null : sequence;
}

export function parseAdvanceDatedSequence(
  number: string | null | undefined,
  expectedMonthPeriod: string,
): number | null {
  if (!number) {
    return null;
  }

  const match = ADVANCE_DATED_NUMBER_PATTERN.exec(number.trim());

  if (!match) {
    return null;
  }

  const month = match[2]!;
  const year = match[3]!;

  if (!matchesMonthPeriod(month, year, expectedMonthPeriod)) {
    return null;
  }

  const sequence = Number.parseInt(match[1]!, 10);

  return Number.isNaN(sequence) ? null : sequence;
}

export function parseFinalDatedSequence(
  number: string | null | undefined,
  expectedMonthPeriod: string,
): number | null {
  if (!number) {
    return null;
  }

  const match = FINAL_DATED_NUMBER_PATTERN.exec(number.trim());

  if (!match) {
    return null;
  }

  const month = match[2]!;
  const year = match[3]!;

  if (!matchesMonthPeriod(month, year, expectedMonthPeriod)) {
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

  const match = ADVANCE_LEGACY_PREFIX_NUMBER_PATTERN.exec(number.trim());

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

  const match = FINAL_LEGACY_PREFIX_NUMBER_PATTERN.exec(number.trim());

  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1]!, 10);

  return Number.isNaN(sequence) ? null : sequence;
}

export function invoiceNumberFormatsAreDistinct(
  sequence: number,
  yearMonth: string,
): boolean {
  const numbers = (['FULL', 'ADVANCE', 'FINAL'] as const).map((invoiceType) =>
    formatInvoiceNumber(sequence, yearMonth, invoiceType),
  );

  return new Set(numbers).size === numbers.length;
}

export function maxInvoiceNumberSequence(
  numbers: Array<string | null | undefined>,
  yearMonth: string,
  invoiceType: InvoiceType,
): number {
  const monthPeriod = yearMonthToMonthPeriod(yearMonth);

  if (invoiceType === 'FULL') {
    return numbers.reduce((max, number) => {
      const sequence = parseInvoiceNumberSequence(number, monthPeriod);

      if (sequence === null) {
        return max;
      }

      return Math.max(max, sequence);
    }, 0);
  }

  let numericMax = 0;
  let legacyPrefixedCount = 0;

  for (const number of numbers) {
    if (invoiceType === 'ADVANCE') {
      const advanceDatedSequence = parseAdvanceDatedSequence(number, monthPeriod);

      if (advanceDatedSequence !== null) {
        numericMax = Math.max(numericMax, advanceDatedSequence);
        continue;
      }

      const legacyPlainSequence = parseInvoiceNumberSequence(number, monthPeriod);

      if (legacyPlainSequence !== null) {
        numericMax = Math.max(numericMax, legacyPlainSequence);
        continue;
      }

      if (parseAdvancePrefixedSequence(number) !== null) {
        legacyPrefixedCount += 1;
      }

      continue;
    }

    const finalDatedSequence = parseFinalDatedSequence(number, monthPeriod);

    if (finalDatedSequence !== null) {
      numericMax = Math.max(numericMax, finalDatedSequence);
      continue;
    }

    const legacyPlainSequence = parseInvoiceNumberSequence(number, monthPeriod);

    if (legacyPlainSequence !== null) {
      numericMax = Math.max(numericMax, legacyPlainSequence);
      continue;
    }

    if (parseFinalPrefixedSequence(number) !== null) {
      legacyPrefixedCount += 1;
    }
  }

  return numericMax + legacyPrefixedCount;
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
