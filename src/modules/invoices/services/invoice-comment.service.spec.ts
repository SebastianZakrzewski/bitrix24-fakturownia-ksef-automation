import { InvoiceCommentService } from './invoice-comment.service';

describe('InvoiceCommentService', () => {
  const service = new InvoiceCommentService();

  describe('buildInvoiceCreatedComment', () => {
    it('builds a deterministic Polish message with invoice type and URL', () => {
      const message = service.buildInvoiceCreatedComment({
        invoiceType: 'FULL',
        fakturowniaInvoiceUrl: 'https://evapremium.fakturownia.pl/invoices/987654',
        fakturowniaInvoiceId: '987654',
      });

      expect(message).toContain('Faktura Pełna');
      expect(message).toContain('ID: 987654');
      expect(message).toContain(
        'Link do faktury: https://evapremium.fakturownia.pl/invoices/987654',
      );
    });

    it('uses ADVANCE and FINAL type labels', () => {
      expect(
        service.buildInvoiceCreatedComment({
          invoiceType: 'ADVANCE',
          fakturowniaInvoiceUrl: 'https://example.test/advance',
        }),
      ).toContain('Faktura Zaliczkowa');

      expect(
        service.buildInvoiceCreatedComment({
          invoiceType: 'FINAL',
          fakturowniaInvoiceUrl: 'https://example.test/final',
        }),
      ).toContain('Faktura Dopełniająca');
    });
  });

  describe('buildValidationFailureComment', () => {
    it('lists validation error codes and messages', () => {
      const message = service.buildValidationFailureComment({
        errors: [
          { code: 'MISSING_NIP', message: 'Company NIP is required.' },
          { code: 'MISSING_PRODUCTS', message: 'At least one product is required.' },
        ],
      });

      expect(message).toContain('[SellGenius] Walidacja faktury nie powiodła się:');
      expect(message).toContain('- MISSING_NIP: Company NIP is required.');
      expect(message).toContain(
        '- MISSING_PRODUCTS: At least one product is required.',
      );
    });
  });
});
