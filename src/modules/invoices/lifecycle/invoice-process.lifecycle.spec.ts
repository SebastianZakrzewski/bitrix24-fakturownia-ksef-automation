import {
  InvalidInvoiceProcessTransitionError,
} from '../errors/invoice-process.errors';
import type { InvoiceProcessStatus } from '../types/invoice.types';
import {
  assertCanTransition,
  buildIdempotencyKey,
  canTransition,
  getAllowedTransitions,
  isTerminalStatus,
} from './invoice-process.lifecycle';

const ALLOWED_TRANSITION_CASES: ReadonlyArray<
  readonly [InvoiceProcessStatus, InvoiceProcessStatus]
> = [
  ['TRIGGER_RECEIVED', 'VALIDATION_FAILED'],
  ['TRIGGER_RECEIVED', 'INVOICE_CREATION_IN_PROGRESS'],
  ['VALIDATION_FAILED', 'TRIGGER_RECEIVED'],
  ['INVOICE_CREATION_IN_PROGRESS', 'FAKTUROWNIA_ERROR'],
  ['INVOICE_CREATION_IN_PROGRESS', 'UNKNOWN_AFTER_TIMEOUT'],
  ['INVOICE_CREATION_IN_PROGRESS', 'INVOICE_CREATED'],
  ['FAKTUROWNIA_ERROR', 'INVOICE_CREATION_IN_PROGRESS'],
  ['UNKNOWN_AFTER_TIMEOUT', 'MANUAL_REVIEW_REQUIRED'],
  ['MANUAL_REVIEW_REQUIRED', 'INVOICE_CREATION_IN_PROGRESS'],
  ['INVOICE_CREATED', 'KSEF_SUBMISSION_CONFIRMED'],
  ['INVOICE_CREATED', 'KSEF_SUBMISSION_ERROR'],
  ['INVOICE_CREATED', 'KSEF_STATUS_UNKNOWN'],
  ['KSEF_SUBMISSION_CONFIRMED', 'COMPLETED'],
  ['KSEF_SUBMISSION_ERROR', 'MANUAL_REVIEW_REQUIRED'],
  ['KSEF_STATUS_UNKNOWN', 'MANUAL_REVIEW_REQUIRED'],
];

const FORBIDDEN_TRANSITION_CASES: ReadonlyArray<
  readonly [InvoiceProcessStatus, InvoiceProcessStatus]
> = [
  ['COMPLETED', 'TRIGGER_RECEIVED'],
  ['TRIGGER_RECEIVED', 'COMPLETED'],
  ['INVOICE_CREATED', 'INVOICE_CREATION_IN_PROGRESS'],
  ['COMPLETED', 'INVOICE_CREATION_IN_PROGRESS'],
  ['VALIDATION_FAILED', 'INVOICE_CREATED'],
];

const DOCUMENTED_PROCESS_STATUSES: InvoiceProcessStatus[] = [
  'TRIGGER_RECEIVED',
  'VALIDATION_FAILED',
  'INVOICE_CREATION_IN_PROGRESS',
  'FAKTUROWNIA_ERROR',
  'UNKNOWN_AFTER_TIMEOUT',
  'INVOICE_CREATED',
  'KSEF_SUBMISSION_CONFIRMED',
  'KSEF_SUBMISSION_ERROR',
  'KSEF_STATUS_UNKNOWN',
  'MANUAL_REVIEW_REQUIRED',
  'COMPLETED',
];

describe('invoice-process.lifecycle', () => {
  describe('buildIdempotencyKey', () => {
    it('formats deal id and invoice type', () => {
      expect(buildIdempotencyKey('deal-100', 'FULL')).toBe('deal-100:FULL');
      expect(buildIdempotencyKey('deal-200', 'ADVANCE')).toBe('deal-200:ADVANCE');
    });
  });

  describe('canTransition', () => {
    it.each(ALLOWED_TRANSITION_CASES)(
      'allows %s -> %s',
      (from, to) => {
        expect(canTransition(from, to)).toBe(true);
      },
    );

    it.each(FORBIDDEN_TRANSITION_CASES)(
      'denies %s -> %s',
      (from, to) => {
        expect(canTransition(from, to)).toBe(false);
      },
    );
  });

  describe('assertCanTransition', () => {
    it('does not throw for allowed transition', () => {
      expect(() =>
        assertCanTransition('TRIGGER_RECEIVED', 'VALIDATION_FAILED'),
      ).not.toThrow();
    });

    it('throws InvalidInvoiceProcessTransitionError for forbidden transition', () => {
      expect(() => assertCanTransition('COMPLETED', 'TRIGGER_RECEIVED')).toThrow(
        InvalidInvoiceProcessTransitionError,
      );
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns documented targets for TRIGGER_RECEIVED', () => {
      expect(getAllowedTransitions('TRIGGER_RECEIVED')).toEqual([
        'VALIDATION_FAILED',
        'INVOICE_CREATION_IN_PROGRESS',
      ]);
    });

    it('returns empty array for terminal COMPLETED', () => {
      expect(getAllowedTransitions('COMPLETED')).toEqual([]);
    });
  });

  describe('isTerminalStatus', () => {
    it('returns true only for COMPLETED', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true);
    });

    it.each(
      DOCUMENTED_PROCESS_STATUSES.filter((status) => status !== 'COMPLETED'),
    )('returns false for %s', (status) => {
      expect(isTerminalStatus(status)).toBe(false);
    });
  });
});
