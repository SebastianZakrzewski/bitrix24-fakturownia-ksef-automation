import { Injectable } from '@nestjs/common';
import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import type { Bitrix24ContactRaw } from '../types/bitrix24-api.types';

@Injectable()
export class Bitrix24ContactService {
  constructor(
    private readonly client: Bitrix24Client,
    private readonly mapper: Bitrix24Mapper,
  ) {}

  async getPrimaryEmailByContactId(contactId: string): Promise<string | undefined> {
    const raw = await this.client.call<Bitrix24ContactRaw>(
      'CONTACT_GET',
      'crm.contact.get',
      { id: contactId },
    );

    return this.mapper.mapContactPrimaryEmail(raw);
  }
}
