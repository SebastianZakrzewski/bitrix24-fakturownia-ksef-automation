export type Bitrix24Operation =
  | 'DEAL_GET'
  | 'COMPANY_GET'
  | 'COMPANY_ADDRESS_LIST'
  | 'PRODUCT_ROWS_LIST'
  | 'TIMELINE_COMMENT_ADD'
  | 'DEAL_FIELD_UPDATE';

export class Bitrix24ApiError extends Error {
  readonly operation: Bitrix24Operation;
  readonly method: string;
  readonly httpStatus?: number;
  readonly bitrixErrorCode?: string;
  readonly bitrixErrorDescription?: string;

  constructor(params: {
    operation: Bitrix24Operation;
    method: string;
    message: string;
    httpStatus?: number;
    bitrixErrorCode?: string;
    bitrixErrorDescription?: string;
  }) {
    super(params.message);
    this.name = 'Bitrix24ApiError';
    this.operation = params.operation;
    this.method = params.method;
    this.httpStatus = params.httpStatus;
    this.bitrixErrorCode = params.bitrixErrorCode;
    this.bitrixErrorDescription = params.bitrixErrorDescription;
  }
}
