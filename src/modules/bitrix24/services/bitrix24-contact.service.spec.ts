import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import { bitrixContactRawFixture } from '../testing/bitrix24.fixtures';
import { Bitrix24ContactService } from './bitrix24-contact.service';

describe('Bitrix24ContactService', () => {
  it('loads contact and maps primary email from first EMAIL entry', async () => {
    const client = {
      call: jest.fn().mockResolvedValueOnce(bitrixContactRawFixture()),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24ContactService(client, new Bitrix24Mapper());
    const email = await service.getPrimaryEmailByContactId('15532');

    expect(client.call).toHaveBeenCalledWith('CONTACT_GET', 'crm.contact.get', {
      id: '15532',
    });
    expect(email).toBe('billing@evapremium.test');
  });

  it('returns undefined when contact has no email entries', async () => {
    const client = {
      call: jest.fn().mockResolvedValueOnce({
        ID: '15532',
        EMAIL: [],
      }),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24ContactService(client, new Bitrix24Mapper());
    const email = await service.getPrimaryEmailByContactId('15532');

    expect(email).toBeUndefined();
  });
});
