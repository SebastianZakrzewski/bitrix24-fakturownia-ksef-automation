import { InvalidInvoiceProcessTransitionError } from '../errors/invoice-process.errors';
import { InvoiceProcessService } from './invoice-process.service';

describe('InvoiceProcessService', () => {
  const service = new InvoiceProcessService();

  it('delegates canTransition to lifecycle module', () => {
    expect(
      service.canTransition('TRIGGER_RECEIVED', 'VALIDATION_FAILED'),
    ).toBe(true);
    expect(service.canTransition('COMPLETED', 'TRIGGER_RECEIVED')).toBe(false);
  });

  it('delegates assertCanTransition to lifecycle module', () => {
    expect(() =>
      service.assertCanTransition('INVOICE_CREATED', 'KSEF_SUBMISSION_CONFIRMED'),
    ).not.toThrow();

    expect(() =>
      service.assertCanTransition('COMPLETED', 'TRIGGER_RECEIVED'),
    ).toThrow(InvalidInvoiceProcessTransitionError);
  });

  it('delegates getAllowedTransitions to lifecycle module', () => {
    expect(service.getAllowedTransitions('COMPLETED')).toEqual([]);
  });

  it('delegates isTerminalStatus to lifecycle module', () => {
    expect(service.isTerminalStatus('COMPLETED')).toBe(true);
    expect(service.isTerminalStatus('TRIGGER_RECEIVED')).toBe(false);
  });
});
