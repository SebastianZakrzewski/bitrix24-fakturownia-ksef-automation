import { IsIn, IsString, MinLength } from 'class-validator';

export type TechnicalRetryTargetAction =
  | 'RETRY_VALIDATION_AND_PROCESS'
  | 'RETRY_FAKTUROWNIA_CREATION'
  | 'RETRY_BITRIX_SYNC';

export class TechnicalRetryRequestDto {
  @IsString()
  @MinLength(1)
  reason!: string;

  @IsString()
  @MinLength(1)
  requested_by!: string;

  @IsIn([
    'RETRY_VALIDATION_AND_PROCESS',
    'RETRY_FAKTUROWNIA_CREATION',
    'RETRY_BITRIX_SYNC',
  ])
  target_action!: TechnicalRetryTargetAction;
}
