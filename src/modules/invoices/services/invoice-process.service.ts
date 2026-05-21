import { Injectable } from '@nestjs/common';
import {
  assertCanTransition as assertCanTransitionLifecycle,
  canTransition as canTransitionLifecycle,
  getAllowedTransitions as getAllowedTransitionsLifecycle,
  isTerminalStatus as isTerminalStatusLifecycle,
} from '../lifecycle/invoice-process.lifecycle';
import type { InvoiceProcessStatus } from '../types/invoice.types';

@Injectable()
export class InvoiceProcessService {
  canTransition(from: InvoiceProcessStatus, to: InvoiceProcessStatus): boolean {
    return canTransitionLifecycle(from, to);
  }

  assertCanTransition(
    from: InvoiceProcessStatus,
    to: InvoiceProcessStatus,
  ): void {
    assertCanTransitionLifecycle(from, to);
  }

  getAllowedTransitions(from: InvoiceProcessStatus): InvoiceProcessStatus[] {
    return getAllowedTransitionsLifecycle(from);
  }

  isTerminalStatus(status: InvoiceProcessStatus): boolean {
    return isTerminalStatusLifecycle(status);
  }
}
