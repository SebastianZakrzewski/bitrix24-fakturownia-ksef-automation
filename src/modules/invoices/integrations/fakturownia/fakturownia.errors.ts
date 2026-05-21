export type FakturowniaErrorCategory =
  | 'CLIENT'
  | 'SERVER'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class FakturowniaApiError extends Error {
  readonly category: FakturowniaErrorCategory;
  readonly httpStatus?: number;
  readonly responseBody?: unknown;

  constructor(params: {
    category: FakturowniaErrorCategory;
    message: string;
    httpStatus?: number;
    responseBody?: unknown;
  }) {
    super(params.message);
    this.name = 'FakturowniaApiError';
    this.category = params.category;
    this.httpStatus = params.httpStatus;
    this.responseBody = params.responseBody;
  }
}

export class FakturowniaMapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FakturowniaMapperError';
  }
}
