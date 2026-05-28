import { InvalidInvoiceProcessTransitionError } from '../errors/invoice-process.errors';
import type {
  InvoiceProcessStatus,
  InvoiceType,
} from '../types/invoice.types';

const ALLOWED_TRANSITIONS: Readonly<
  Record<InvoiceProcessStatus, readonly InvoiceProcessStatus[]>
> = {
  TRIGGER_RECEIVED: ['VALIDATION_FAILED', 'INVOICE_CREATION_IN_PROGRESS'],
  VALIDATION_FAILED: ['TRIGGER_RECEIVED'],
  INVOICE_CREATION_IN_PROGRESS: [
    'FAKTUROWNIA_ERROR',
    'UNKNOWN_AFTER_TIMEOUT',
    'INVOICE_CREATED',
  ],
  FAKTUROWNIA_ERROR: ['INVOICE_CREATION_IN_PROGRESS'],
  UNKNOWN_AFTER_TIMEOUT: ['MANUAL_REVIEW_REQUIRED'],
  MANUAL_REVIEW_REQUIRED: ['INVOICE_CREATION_IN_PROGRESS'],
  INVOICE_CREATED: [
    'KSEF_SUBMISSION_CONFIRMED',
    'KSEF_SUBMISSION_ERROR',
    'KSEF_STATUS_UNKNOWN',
    'MANUAL_REVIEW_REQUIRED',
  ],
  KSEF_SUBMISSION_CONFIRMED: ['COMPLETED', 'MANUAL_REVIEW_REQUIRED'],
  KSEF_SUBMISSION_ERROR: ['MANUAL_REVIEW_REQUIRED'],
  KSEF_STATUS_UNKNOWN: ['MANUAL_REVIEW_REQUIRED'],
  COMPLETED: [],
};

const TERMINAL_STATUSES: ReadonlySet<InvoiceProcessStatus> = new Set([
  'COMPLETED',
]);

export function buildIdempotencyKey(
  bitrixDealId: string,
  invoiceType: InvoiceType,
): string {
  return `${bitrixDealId}:${invoiceType}`;
}

export function canTransition(
  from: InvoiceProcessStatus,
  to: InvoiceProcessStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertCanTransition(
  from: InvoiceProcessStatus,
  to: InvoiceProcessStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidInvoiceProcessTransitionError(from, to);
  }
}

export function getAllowedTransitions(
  from: InvoiceProcessStatus,
): InvoiceProcessStatus[] {
  return [...ALLOWED_TRANSITIONS[from]];
}

export function isTerminalStatus(status: InvoiceProcessStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
