import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.validation';
import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import { bitrixDealRawFixture } from '../testing/bitrix24.fixtures';
import { Bitrix24DealService } from './bitrix24-deal.service';

describe('Bitrix24DealService', () => {
  it('loads and maps a deal by id', async () => {
    const client = {
      call: jest.fn().mockResolvedValue(bitrixDealRawFixture()),
    } as unknown as Bitrix24Client;

    const configService = {
      get: jest.fn().mockReturnValue('https://portal.bitrix24.pl'),
    } as unknown as ConfigService<AppEnv, true>;

    const service = new Bitrix24DealService(
      client,
      new Bitrix24Mapper(),
      configService,
    );

    const deal = await service.getDealById('42');

    expect(client.call).toHaveBeenCalledWith('DEAL_GET', 'crm.deal.get', {
      id: '42',
    });
    expect(deal.dealId).toBe('42');
    expect(deal.customFields.UF_INVOICE_TYPE).toBe('FULL');
    expect(deal.dealUrl).toContain('/crm/deal/details/42/');
  });
});
