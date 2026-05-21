import { Injectable } from '@nestjs/common';
import { Bitrix24Client } from '../client/bitrix24.client';
import { Bitrix24Mapper } from '../mappers/bitrix24.mapper';
import type { Bitrix24ProductRowsListResult } from '../types/bitrix24-api.types';
import type { BitrixProductRow } from '../types/bitrix24.types';

@Injectable()
export class Bitrix24ProductRowService {
  constructor(
    private readonly client: Bitrix24Client,
    private readonly mapper: Bitrix24Mapper,
  ) {}

  async listByDealId(dealId: string): Promise<BitrixProductRow[]> {
    const rawRows = await this.client.call<Bitrix24ProductRowsListResult>(
      'PRODUCT_ROWS_LIST',
      'crm.deal.productrows.get',
      { id: dealId },
    );

    if (!Array.isArray(rawRows)) {
      return [];
    }

    return rawRows.map((row) => this.mapper.mapProductRow(row));
  }
}
