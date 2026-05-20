import {
  InvoiceEventType,
  InvoiceProcessStatus,
} from './invoice.types';

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

describe('invoice lifecycle types', () => {
  it('does not include STALE_TRIGGER_IGNORED in InvoiceProcessStatus', () => {
    expect(DOCUMENTED_PROCESS_STATUSES).not.toContain('STALE_TRIGGER_IGNORED');
  });

  it('includes STALE_TRIGGER_IGNORED only as InvoiceEventType', () => {
    const eventType: InvoiceEventType = 'STALE_TRIGGER_IGNORED';

    expect(eventType).toBe('STALE_TRIGGER_IGNORED');
    expect(DOCUMENTED_PROCESS_STATUSES).not.toContain(eventType);
  });
});
