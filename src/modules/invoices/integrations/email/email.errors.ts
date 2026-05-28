export type EmailProviderErrorCategory =
  | 'CLIENT'
  | 'SERVER'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class EmailProviderApiError extends Error {
  readonly category: EmailProviderErrorCategory;
  readonly httpStatus?: number;
  readonly responseBody?: unknown;
  readonly errorCode?: string;

  constructor(params: {
    category: EmailProviderErrorCategory;
    message: string;
    httpStatus?: number;
    responseBody?: unknown;
    errorCode?: string;
  }) {
    super(params.message);
    this.name = 'EmailProviderApiError';
    this.category = params.category;
    this.httpStatus = params.httpStatus;
    this.responseBody = params.responseBody;
    this.errorCode = params.errorCode;
  }
}
