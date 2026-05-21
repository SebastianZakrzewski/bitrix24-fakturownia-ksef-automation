import { Injectable } from '@nestjs/common';
import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import type {
  Bitrix24AddressListResult,
  Bitrix24AddressRaw,
  Bitrix24CompanyRaw,
  Bitrix24RequisiteListResult,
  Bitrix24RequisiteRaw,
} from '../types/bitrix24-api.types';
import type {
  Bitrix24GetCompanyOptions,
  BitrixCompanyData,
} from '../types/bitrix24.types';

const BITRIX_COMPANY_ENTITY_TYPE_ID = '4';

@Injectable()
export class Bitrix24CompanyService {
  constructor(
    private readonly client: Bitrix24Client,
    private readonly mapper: Bitrix24Mapper,
  ) {}

  async getCompanyById(
    companyId: string,
    options?: Bitrix24GetCompanyOptions,
  ): Promise<BitrixCompanyData> {
    const companyRaw = await this.client.call<Bitrix24CompanyRaw>(
      'COMPANY_GET',
      'crm.company.get',
      { id: companyId },
    );

    const requisites = await this.client.call<Bitrix24RequisiteListResult>(
      'COMPANY_GET',
      'crm.requisite.list',
      {
        filter: {
          ENTITY_TYPE_ID: BITRIX_COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyId,
        },
      },
    );

    const requisiteRaw = this.pickPrimaryRequisite(requisites);
    const addressSource = options?.addressSource ?? 'REQUISITE';
    const addressRaw =
      addressSource === 'CRM_ADDRESS_LIST'
        ? await this.loadPrimaryAddress(companyId)
        : undefined;

    return this.mapper.mapCompany(companyRaw, requisiteRaw, {
      addressSource,
      addressRaw,
    });
  }

  private async loadPrimaryAddress(
    companyId: string,
  ): Promise<Bitrix24AddressRaw | undefined> {
    const addresses = await this.client.call<Bitrix24AddressListResult>(
      'COMPANY_ADDRESS_LIST',
      'crm.address.list',
      {
        filter: {
          ENTITY_TYPE_ID: BITRIX_COMPANY_ENTITY_TYPE_ID,
          ENTITY_ID: companyId,
        },
      },
    );

    return this.pickPrimaryAddress(addresses);
  }

  private pickPrimaryRequisite(
    requisites: Bitrix24RequisiteListResult,
  ): Bitrix24RequisiteRaw | undefined {
    if (!Array.isArray(requisites) || requisites.length === 0) {
      return undefined;
    }

    return requisites[0];
  }

  private pickPrimaryAddress(
    addresses: Bitrix24AddressListResult,
  ): Bitrix24AddressRaw | undefined {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return undefined;
    }

    return addresses[0];
  }
}
