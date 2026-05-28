import { EmailProviderApiError } from '../integrations/email/email.errors';
import { EmailProviderService } from '../integrations/email/email-provider.service';
import { InvoiceEmailMapper } from '../integrations/email/invoice-email.mapper';
import { FakturowniaService } from '../integrations/fakturownia/fakturownia.service';
import { InvoiceEventRepository } from '../repositories/invoice-event.repository';
import {
  CUSTOMER_INVOICE_EMAIL_SENT_EVENT,
  FAKTUROWNIA_PDF_DOWNLOAD_FAILED_EVENT,
  InvoiceEmailService,
} from './invoice-email.service';

describe('InvoiceEmailService', () => {
  const invoiceDraft = {
    bitrixDealId: '27000',
    invoiceType: 'FULL' as const,
    buyer: {
      companyName: 'Evapremium Sp. z o.o.',
      nip: '5261040828',
      street: 'ul. Testowa 1',
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
      customerEmail: 'client@example.com',
    },
    products: [],
    currency: 'PLN' as const,
    vatRate: 23 as const,
  };

  const fakturowniaResult = {
    fakturowniaInvoiceId: '987654',
    fakturowniaInvoiceUrl: 'https://evapremium.fakturownia.pl/invoices/987654',
    totalNet: 100,
    totalGross: 123,
    currency: 'PLN' as const,
  };

  const createService = () => {
    const invoiceEventRepository = {
      existsByProcessIdAndEventType: jest.fn().mockResolvedValue(false),
      insert: jest.fn().mockResolvedValue({}),
    } as unknown as InvoiceEventRepository;

    const fakturowniaService = {
      downloadInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
    } as unknown as FakturowniaService;

    const emailProviderService = {
      sendInvoiceEmail: jest.fn().mockResolvedValue({
        success: true,
        provider: 'n8n',
        providerMessageId: 'msg-1',
        sentAt: '2026-01-01T00:00:00.000Z',
      }),
    };

    const service = new InvoiceEmailService(
      invoiceEventRepository,
      fakturowniaService,
      emailProviderService as unknown as EmailProviderService,
      new InvoiceEmailMapper(),
    );

    return {
      service,
      invoiceEventRepository,
      fakturowniaService,
      emailProviderService,
    };
  };

  it('sends customer invoice email with pdf attachment when download succeeds', async () => {
    const { service, emailProviderService, invoiceEventRepository } = createService();

    await service.sendCustomerInvoice({
      processId: 'process-1',
      bitrixDealId: '27000',
      invoiceDraft,
      fakturowniaResult,
    });

    expect(emailProviderService.sendInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        pdfAttachment: expect.objectContaining({
          filename: 'faktura-987654.pdf',
          contentType: 'application/pdf',
        }),
      }),
    );
    expect(invoiceEventRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: CUSTOMER_INVOICE_EMAIL_SENT_EVENT,
        metadata: expect.objectContaining({
          recipient_email_redacted: 'c***@example.com',
          pdf_attached: true,
        }),
      }),
    );
  });

  it('does not send duplicate email when success event already exists', async () => {
    const { service, emailProviderService, invoiceEventRepository } = createService();
    invoiceEventRepository.existsByProcessIdAndEventType = jest
      .fn()
      .mockResolvedValue(true);

    await service.sendCustomerInvoice({
      processId: 'process-1',
      bitrixDealId: '27000',
      invoiceDraft,
      fakturowniaResult,
    });

    expect(emailProviderService.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it('falls back to link-only email when pdf download fails', async () => {
    const { service, fakturowniaService, emailProviderService, invoiceEventRepository } =
      createService();
    fakturowniaService.downloadInvoicePdf = jest
      .fn()
      .mockRejectedValue(new EmailProviderApiError({
        category: 'CLIENT',
        message: 'Fakturownia HTTP 404',
      }));

    await service.sendCustomerInvoice({
      processId: 'process-1',
      bitrixDealId: '27000',
      invoiceDraft,
      fakturowniaResult,
    });

    expect(emailProviderService.sendInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        fakturowniaInvoiceUrl: fakturowniaResult.fakturowniaInvoiceUrl,
      }),
    );
    expect(
      emailProviderService.sendInvoiceEmail.mock.calls[0]?.[0]?.pdfAttachment,
    ).toBeUndefined();
    expect(invoiceEventRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: FAKTUROWNIA_PDF_DOWNLOAD_FAILED_EVENT,
      }),
    );
  });
});
