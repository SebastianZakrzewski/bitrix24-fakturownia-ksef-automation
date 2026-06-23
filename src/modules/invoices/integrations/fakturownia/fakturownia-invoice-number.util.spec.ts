import {
  formatInvoiceNumber,
  getWarsawDateParts,
  invoiceNumberFormatsAreDistinct,
  mapInvoiceTypeToFakturowniaKind,
  maxInvoiceNumberSequence,
  parseAdvanceDatedSequence,
  parseAdvancePrefixedSequence,
  parseFinalDatedSequence,
  parseFinalPrefixedSequence,
  parseInvoiceNumberSequence,
  resolveNextInvoiceSequence,
  yearMonthToMonthPeriod,
} from './fakturownia-invoice-number.util';

describe('fakturownia-invoice-number.util', () => {
  describe('mapInvoiceTypeToFakturowniaKind', () => {
    it('maps invoice types to Fakturownia kinds', () => {
      expect(mapInvoiceTypeToFakturowniaKind('FULL')).toBe('vat');
      expect(mapInvoiceTypeToFakturowniaKind('ADVANCE')).toBe('advance');
      expect(mapInvoiceTypeToFakturowniaKind('FINAL')).toBe('final');
    });
  });

  describe('formatInvoiceNumber', () => {
    it('formats FULL as n/MM/YYYY', () => {
      expect(formatInvoiceNumber(39, '2026-05', 'FULL')).toBe('39/05/2026');
    });

    it('formats ADVANCE with Z prefix', () => {
      expect(formatInvoiceNumber(28, '2026-05', 'ADVANCE')).toBe('Z28/05/2026');
    });

    it('formats FINAL with ZK prefix', () => {
      expect(formatInvoiceNumber(35, '2026-05', 'FINAL')).toBe('ZK35/05/2026');
    });
  });

  describe('invoiceNumberFormatsAreDistinct', () => {
    it('never produces identical numbers across FULL, ADVANCE and FINAL', () => {
      for (const sequence of [1, 28, 39, 100]) {
        expect(invoiceNumberFormatsAreDistinct(sequence, '2026-06')).toBe(true);

        const numbers = (['FULL', 'ADVANCE', 'FINAL'] as const).map(
          (invoiceType) => formatInvoiceNumber(sequence, '2026-06', invoiceType),
        );

        expect(new Set(numbers).size).toBe(3);
      }

      expect(formatInvoiceNumber(1, '2026-06', 'FULL')).toBe('1/06/2026');
      expect(formatInvoiceNumber(1, '2026-06', 'ADVANCE')).toBe('Z1/06/2026');
      expect(formatInvoiceNumber(1, '2026-06', 'FINAL')).toBe('ZK1/06/2026');
    });
  });

  describe('parseInvoiceNumberSequence', () => {
    it('parses matching month period with dot separator', () => {
      expect(parseInvoiceNumberSequence('38/05.2026', '05.2026')).toBe(38);
    });

    it('parses matching month period with slash separator', () => {
      expect(parseInvoiceNumberSequence('38/05/2026', '05.2026')).toBe(38);
    });

    it('ignores numbers from other months', () => {
      expect(parseInvoiceNumberSequence('29/04.2026', '05.2026')).toBeNull();
      expect(parseInvoiceNumberSequence('29/04/2026', '05.2026')).toBeNull();
    });

    it('ignores prefixed formats', () => {
      expect(parseInvoiceNumberSequence('Z38/05/2026', '05.2026')).toBeNull();
      expect(parseInvoiceNumberSequence('ZK38/05/2026', '05.2026')).toBeNull();
      expect(parseInvoiceNumberSequence('FV/1/2026', '05.2026')).toBeNull();
      expect(parseInvoiceNumberSequence(undefined, '05.2026')).toBeNull();
    });
  });

  describe('parseAdvanceDatedSequence', () => {
    it('parses Z-prefixed dated advance numbers', () => {
      expect(parseAdvanceDatedSequence('Z28/05/2026', '05.2026')).toBe(28);
      expect(parseAdvanceDatedSequence('Z28/05.2026', '05.2026')).toBe(28);
    });

    it('ignores other formats', () => {
      expect(parseAdvanceDatedSequence('28/05/2026', '05.2026')).toBeNull();
      expect(parseAdvanceDatedSequence('Z1', '05.2026')).toBeNull();
    });
  });

  describe('parseFinalDatedSequence', () => {
    it('parses ZK-prefixed dated final numbers', () => {
      expect(parseFinalDatedSequence('ZK35/05/2026', '05.2026')).toBe(35);
    });

    it('ignores other formats', () => {
      expect(parseFinalDatedSequence('35/05/2026', '05.2026')).toBeNull();
      expect(parseFinalDatedSequence('ZK1', '05.2026')).toBeNull();
    });
  });

  describe('parseAdvancePrefixedSequence', () => {
    it('parses legacy Z-prefixed advance numbers', () => {
      expect(parseAdvancePrefixedSequence('Z1')).toBe(1);
      expect(parseAdvancePrefixedSequence('Z26')).toBe(26);
    });

    it('ignores non-legacy formats', () => {
      expect(parseAdvancePrefixedSequence('ZK1')).toBeNull();
      expect(parseAdvancePrefixedSequence('Z26/05/2026')).toBeNull();
      expect(parseAdvancePrefixedSequence('26/05/2026')).toBeNull();
    });
  });

  describe('parseFinalPrefixedSequence', () => {
    it('parses legacy ZK-prefixed final numbers', () => {
      expect(parseFinalPrefixedSequence('ZK1')).toBe(1);
      expect(parseFinalPrefixedSequence('ZK33')).toBe(33);
    });

    it('ignores non-legacy formats', () => {
      expect(parseFinalPrefixedSequence('Z1')).toBeNull();
      expect(parseFinalPrefixedSequence('ZK33/05/2026')).toBeNull();
      expect(parseFinalPrefixedSequence('33/05/2026')).toBeNull();
    });
  });

  describe('maxInvoiceNumberSequence', () => {
    it('returns highest sequence for the target month (FULL)', () => {
      expect(
        maxInvoiceNumberSequence(
          ['7/05.2026', '26/05/2026', '38/05/2026', '29/04/2026', 'invalid'],
          '2026-05',
          'FULL',
        ),
      ).toBe(38);
    });

    it('uses dated Z-prefixed ADVANCE numbers for max sequence', () => {
      expect(
        maxInvoiceNumberSequence(
          ['Z26/05/2026', 'Z27/05/2026'],
          '2026-05',
          'ADVANCE',
        ),
      ).toBe(27);
    });

    it('adds one sequence slot per legacy Z-prefixed ADVANCE invoice', () => {
      expect(
        maxInvoiceNumberSequence(
          ['26/05/2026', 'Z1', '24/05/2026'],
          '2026-05',
          'ADVANCE',
        ),
      ).toBe(27);
    });

    it('uses dated ZK-prefixed FINAL numbers for max sequence', () => {
      expect(
        maxInvoiceNumberSequence(
          ['ZK33/05/2026', 'ZK34/05/2026'],
          '2026-05',
          'FINAL',
        ),
      ).toBe(34);
    });

    it('adds one sequence slot per legacy ZK-prefixed FINAL invoice', () => {
      expect(
        maxInvoiceNumberSequence(
          ['33/05/2026', 'ZK1', '32/05/2026'],
          '2026-05',
          'FINAL',
        ),
      ).toBe(34);
    });

    it('counts only legacy prefixed ADVANCE invoices when no dated numbers exist', () => {
      expect(maxInvoiceNumberSequence(['Z1', 'Z2'], '2026-05', 'ADVANCE')).toBe(
        2,
      );
    });
  });

  describe('resolveNextInvoiceSequence', () => {
    it('uses bootstrap floor in bootstrap month', () => {
      expect(
        resolveNextInvoiceSequence({
          apiMaxSequence: 38,
          bootstrapNext: 39,
          isBootstrapMonth: true,
        }),
      ).toBe(39);
    });

    it('uses bootstrap when API max is lower than bootstrap', () => {
      expect(
        resolveNextInvoiceSequence({
          apiMaxSequence: 26,
          bootstrapNext: 28,
          isBootstrapMonth: true,
        }),
      ).toBe(28);
    });

    it('increments after bootstrap value is consumed', () => {
      expect(
        resolveNextInvoiceSequence({
          apiMaxSequence: 39,
          bootstrapNext: 39,
          isBootstrapMonth: true,
        }),
      ).toBe(40);
    });

    it('resets to 1 in non-bootstrap months', () => {
      expect(
        resolveNextInvoiceSequence({
          apiMaxSequence: 0,
          bootstrapNext: 39,
          isBootstrapMonth: false,
        }),
      ).toBe(1);
    });

    it('continues sequence in non-bootstrap months', () => {
      expect(
        resolveNextInvoiceSequence({
          apiMaxSequence: 4,
          bootstrapNext: 39,
          isBootstrapMonth: false,
        }),
      ).toBe(5);
    });
  });

  describe('yearMonthToMonthPeriod', () => {
    it('converts YYYY-MM to MM.YYYY', () => {
      expect(yearMonthToMonthPeriod('2026-05')).toBe('05.2026');
    });
  });

  describe('getWarsawDateParts', () => {
    it('returns ISO date and year-month in Europe/Warsaw', () => {
      const parts = getWarsawDateParts(new Date('2026-05-29T10:00:00.000Z'));

      expect(parts.yearMonth).toBe('2026-05');
      expect(parts.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
