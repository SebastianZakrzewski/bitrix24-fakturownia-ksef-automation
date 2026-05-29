import {
  formatInvoiceNumber,
  getWarsawDateParts,
  mapInvoiceTypeToFakturowniaKind,
  maxInvoiceNumberSequence,
  parseAdvancePrefixedSequence,
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
    it('formats sequence as n/MM.YYYY', () => {
      expect(formatInvoiceNumber(39, '2026-05')).toBe('39/05.2026');
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

    it('ignores invalid formats', () => {
      expect(parseInvoiceNumberSequence('FV/1/2026', '05.2026')).toBeNull();
      expect(parseInvoiceNumberSequence(undefined, '05.2026')).toBeNull();
    });
  });

  describe('parseAdvancePrefixedSequence', () => {
    it('parses Z-prefixed advance numbers', () => {
      expect(parseAdvancePrefixedSequence('Z1')).toBe(1);
      expect(parseAdvancePrefixedSequence('Z26')).toBe(26);
    });

    it('ignores non-Z formats', () => {
      expect(parseAdvancePrefixedSequence('ZK1')).toBeNull();
      expect(parseAdvancePrefixedSequence('26/05/2026')).toBeNull();
    });
  });

  describe('parseFinalPrefixedSequence', () => {
    it('parses ZK-prefixed final numbers', () => {
      expect(parseFinalPrefixedSequence('ZK1')).toBe(1);
      expect(parseFinalPrefixedSequence('ZK33')).toBe(33);
    });

    it('ignores non-ZK formats', () => {
      expect(parseFinalPrefixedSequence('Z1')).toBeNull();
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

    it('adds one sequence slot per Z-prefixed ADVANCE invoice', () => {
      expect(
        maxInvoiceNumberSequence(
          ['26/05/2026', 'Z1', '24/05/2026'],
          '2026-05',
          'ADVANCE',
        ),
      ).toBe(27);
    });

    it('adds one sequence slot per ZK-prefixed FINAL invoice', () => {
      expect(
        maxInvoiceNumberSequence(
          ['33/05/2026', 'ZK1', '32/05/2026'],
          '2026-05',
          'FINAL',
        ),
      ).toBe(34);
    });

    it('counts only prefixed ADVANCE invoices when no numeric numbers exist', () => {
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
