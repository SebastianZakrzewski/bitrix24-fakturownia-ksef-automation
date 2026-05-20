import { Module } from '@nestjs/common';
import { Bitrix24Client } from './client/bitrix24.client';
import { Bitrix24Mapper } from './mappers/bitrix24.mapper';
import { Bitrix24CompanyService } from './services/bitrix24-company.service';
import { Bitrix24DealFieldService } from './services/bitrix24-deal-field.service';
import { Bitrix24DealService } from './services/bitrix24-deal.service';
import { Bitrix24ProductRowService } from './services/bitrix24-product-row.service';
import { Bitrix24TimelineService } from './services/bitrix24-timeline.service';

@Module({
  providers: [
    Bitrix24Client,
    Bitrix24DealService,
    Bitrix24CompanyService,
    Bitrix24ProductRowService,
    Bitrix24TimelineService,
    Bitrix24DealFieldService,
    Bitrix24Mapper,
  ],
  exports: [
    Bitrix24Client,
    Bitrix24DealService,
    Bitrix24CompanyService,
    Bitrix24ProductRowService,
    Bitrix24TimelineService,
    Bitrix24DealFieldService,
    Bitrix24Mapper,
  ],
})
export class Bitrix24Module {}
