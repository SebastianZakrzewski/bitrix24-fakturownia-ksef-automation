import type { InvoiceProcessStatus } from '../types/invoice.types';

export class InvalidInvoiceProcessTransitionError extends Error {
  readonly from: InvoiceProcessStatus;
  readonly to: InvoiceProcessStatus;

  constructor(from: InvoiceProcessStatus, to: InvoiceProcessStatus) {
    super(`Invalid invoice process transition: ${from} -> ${to}`);
    this.name = 'InvalidInvoiceProcessTransitionError';
    this.from = from;
    this.to = to;
  }
}

export class InvoiceCreationBlockedError extends Error {
  readonly code = 'DUPLICATE_INVOICE' as const;
  readonly invoiceProcessId: string;

  constructor(invoiceProcessId: string) {
    super(
      `Invoice creation is permanently blocked for process ${invoiceProcessId}: invoice record already exists`,
    );
    this.name = 'InvoiceCreationBlockedError';
    this.invoiceProcessId = invoiceProcessId;
  }
}
