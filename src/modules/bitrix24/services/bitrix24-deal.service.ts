import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.validation';
import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import type { Bitrix24DealRaw } from '../types/bitrix24-api.types';
import type { BitrixDealCore } from '../types/bitrix24.types';

@Injectable()
export class Bitrix24DealService {
  constructor(
    private readonly client: Bitrix24Client,
    private readonly mapper: Bitrix24Mapper,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async getDealById(dealId: string): Promise<BitrixDealCore> {
    const raw = await this.client.call<Bitrix24DealRaw>('DEAL_GET', 'crm.deal.get', {
      id: dealId,
    });

    return this.mapper.mapDeal(raw, {
      portalBaseUrl: this.configService.get('BITRIX24_PORTAL_URL', { infer: true }),
    });
  }
}
