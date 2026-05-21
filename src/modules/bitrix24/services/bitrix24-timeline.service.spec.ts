import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24TimelineService } from './bitrix24-timeline.service';

describe('Bitrix24TimelineService', () => {
  it('adds a timeline comment on a deal', async () => {
    const client = {
      call: jest.fn().mockResolvedValue(1001),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24TimelineService(client);

    await service.addDealComment({
      dealId: '42',
      message: 'Faktura: https://example.com/invoices/1',
    });

    expect(client.call).toHaveBeenCalledWith(
      'TIMELINE_COMMENT_ADD',
      'crm.timeline.comment.add',
      {
        fields: {
          ENTITY_ID: '42',
          ENTITY_TYPE: 'deal',
          COMMENT: 'Faktura: https://example.com/invoices/1',
        },
      },
    );
  });
});
