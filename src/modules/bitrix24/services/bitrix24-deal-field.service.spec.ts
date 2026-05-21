import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24DealFieldService } from './bitrix24-deal-field.service';

describe('Bitrix24DealFieldService', () => {
  it('updates a deal field using caller-supplied field code', async () => {
    const client = {
      call: jest.fn().mockResolvedValue(true),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24DealFieldService(client);

    await service.updateDealField({
      dealId: '42',
      fieldCode: 'UF_INVOICE_LINK',
      value: 'https://example.com/invoices/1',
    });

    expect(client.call).toHaveBeenCalledWith('DEAL_FIELD_UPDATE', 'crm.deal.update', {
      id: '42',
      fields: {
        UF_INVOICE_LINK: 'https://example.com/invoices/1',
      },
    });
  });
});
