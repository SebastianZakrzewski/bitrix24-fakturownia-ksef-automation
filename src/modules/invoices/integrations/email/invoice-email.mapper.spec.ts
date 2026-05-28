import { InvoiceEmailMapper } from './invoice-email.mapper';

describe('InvoiceEmailMapper', () => {
  const mapper = new InvoiceEmailMapper();

  it('maps internal payload to n8n webhook request', () => {
    expect(
      mapper.toWebhookRequest({
        processId: 'process-1',
        bitrixDealId: '27000',
        invoiceType: 'FULL',
        recipientEmail: 'client@example.com',
        recipientCompanyName: 'Evapremium Sp. z o.o.',
        fakturowniaInvoiceId: '987654',
        fakturowniaInvoiceUrl: 'https://evapremium.fakturownia.pl/invoices/987654',
        pdfAttachment: {
          filename: 'faktura-987654.pdf',
          contentBase64: 'cGRm',
          contentType: 'application/pdf',
        },
      }),
    ).toEqual({
      process_id: 'process-1',
      bitrix_deal_id: '27000',
      invoice_type: 'FULL',
      recipient_email: 'client@example.com',
      recipient_company_name: 'Evapremium Sp. z o.o.',
      fakturownia_invoice_id: '987654',
      fakturownia_invoice_url: 'https://evapremium.fakturownia.pl/invoices/987654',
      pdf_attachment: {
        filename: 'faktura-987654.pdf',
        content_base64: 'cGRm',
        content_type: 'application/pdf',
      },
    });
  });

  it('builds deterministic pdf filename', () => {
    expect(mapper.buildPdfFilename('987654')).toBe('faktura-987654.pdf');
  });
});
