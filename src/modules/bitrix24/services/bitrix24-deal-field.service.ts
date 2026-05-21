import { Injectable } from '@nestjs/common';
import { Bitrix24Client } from '../client/bitrix24.client';
import type { BitrixDealFieldUpdateParams } from '../types/bitrix24.types';

@Injectable()
export class Bitrix24DealFieldService {
  constructor(private readonly client: Bitrix24Client) {}

  async updateDealField(params: BitrixDealFieldUpdateParams): Promise<void> {
    await this.client.call<boolean>('DEAL_FIELD_UPDATE', 'crm.deal.update', {
      id: params.dealId,
      fields: {
        [params.fieldCode]: params.value,
      },
    });
  }
}
