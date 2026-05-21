import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import { bitrixProductRowsRawFixture } from '../testing/bitrix24.fixtures';
import { Bitrix24ProductRowService } from './bitrix24-product-row.service';

describe('Bitrix24ProductRowService', () => {
  it('lists and maps product rows for a deal', async () => {
    const client = {
      call: jest.fn().mockResolvedValue(bitrixProductRowsRawFixture()),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24ProductRowService(client, new Bitrix24Mapper());
    const rows = await service.listByDealId('42');

    expect(client.call).toHaveBeenCalledWith(
      'PRODUCT_ROWS_LIST',
      'crm.deal.productrows.get',
      { id: '42' },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('101');
    expect(rows[0]?.grossPrice).toBe(1500.5);
  });

  it('returns empty array when API result is not an array', async () => {
    const client = {
      call: jest.fn().mockResolvedValue(null),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24ProductRowService(client, new Bitrix24Mapper());

    await expect(service.listByDealId('42')).resolves.toEqual([]);
  });
});
