import { Injectable } from '@nestjs/common';
import { Bitrix24Client } from '../client/bitrix24.client';
import type { BitrixTimelineCommentParams } from '../types/bitrix24.types';

@Injectable()
export class Bitrix24TimelineService {
  constructor(private readonly client: Bitrix24Client) {}

  async addDealComment(params: BitrixTimelineCommentParams): Promise<void> {
    await this.client.call<number>(
      'TIMELINE_COMMENT_ADD',
      'crm.timeline.comment.add',
      {
        fields: {
          ENTITY_ID: params.dealId,
          ENTITY_TYPE: 'deal',
          COMMENT: params.message,
        },
      },
    );
  }
}
