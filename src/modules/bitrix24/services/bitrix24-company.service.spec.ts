import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import {
  bitrixAddressRawFixture,
  bitrixCompanyRawFixture,
  bitrixRequisiteRawFixture,
} from '../testing/bitrix24.fixtures';
import { Bitrix24CompanyService } from './bitrix24-company.service';

describe('Bitrix24CompanyService', () => {
  it('loads company and requisites then maps to BitrixCompanyData', async () => {
    const client = {
      call: jest
        .fn()
        .mockResolvedValueOnce(bitrixCompanyRawFixture())
        .mockResolvedValueOnce([bitrixRequisiteRawFixture()]),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24CompanyService(client, new Bitrix24Mapper());
    const company = await service.getCompanyById('7');

    expect(client.call).toHaveBeenNthCalledWith(
      1,
      'COMPANY_GET',
      'crm.company.get',
      { id: '7' },
    );
    expect(client.call).toHaveBeenNthCalledWith(
      2,
      'COMPANY_GET',
      'crm.requisite.list',
      {
        filter: {
          ENTITY_TYPE_ID: '4',
          ENTITY_ID: '7',
        },
      },
    );
    expect(client.call).toHaveBeenCalledTimes(2);
    expect(company.companyId).toBe('7');
    expect(company.nip).toBe('1234567890');
  });

  it('loads crm.address.list when addressSource is CRM_ADDRESS_LIST', async () => {
    const client = {
      call: jest
        .fn()
        .mockResolvedValueOnce(bitrixCompanyRawFixture())
        .mockResolvedValueOnce([bitrixRequisiteRawFixture()])
        .mockResolvedValueOnce([bitrixAddressRawFixture()]),
    } as unknown as Bitrix24Client;

    const service = new Bitrix24CompanyService(client, new Bitrix24Mapper());
    const company = await service.getCompanyById('7', {
      addressSource: 'CRM_ADDRESS_LIST',
    });

    expect(client.call).toHaveBeenNthCalledWith(
      3,
      'COMPANY_ADDRESS_LIST',
      'crm.address.list',
      {
        filter: {
          ENTITY_TYPE_ID: '4',
          ENTITY_ID: '7',
        },
      },
    );
    expect(company).toMatchObject({
      companyId: '7',
      nip: '1234567890',
      street: 'Filtrowa 34/LA1',
      postalCode: '85-467',
      city: 'Bydgoszcz',
      country: 'Poland',
    });
  });
});
