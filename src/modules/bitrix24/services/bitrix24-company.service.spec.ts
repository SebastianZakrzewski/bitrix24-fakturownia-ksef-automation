import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import {
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
    expect(company.companyId).toBe('7');
    expect(company.nip).toBe('1234567890');
  });
});
