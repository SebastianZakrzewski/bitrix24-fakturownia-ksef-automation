import {
  IsIn,
  IsISO8601,
  IsString,
  MinLength,
} from 'class-validator';

export class BitrixTriggerRequestDto {
  @IsString()
  @MinLength(1)
  bitrix_deal_id!: string;

  @IsIn(['BITRIX24_STAGE_CHANGE'])
  trigger_source!: 'BITRIX24_STAGE_CHANGE';

  @IsString()
  @MinLength(1)
  trigger_stage_id!: string;

  @IsISO8601()
  triggered_at!: string;
}
