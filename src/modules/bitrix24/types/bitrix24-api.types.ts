export type Bitrix24ApiErrorPayload = {
  error: string;
  error_description?: string;
};

export type Bitrix24ApiResponse<T> = {
  result: T;
  time?: Record<string, unknown>;
};

export type Bitrix24DealRaw = {
  ID: string;
  STAGE_ID: string;
  COMPANY_ID?: string;
  CONTACT_ID?: string;
  [key: string]: unknown;
};

export type Bitrix24CompanyRaw = {
  ID: string;
  TITLE?: string;
  ADDRESS?: string;
  ADDRESS_CITY?: string;
  ADDRESS_POSTAL_CODE?: string;
  ADDRESS_COUNTRY?: string;
  [key: string]: unknown;
};

export type Bitrix24ContactEmailRaw = {
  VALUE?: string;
  VALUE_TYPE?: string;
  TYPE_ID?: string;
  ID?: string;
};

export type Bitrix24ContactRaw = {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  EMAIL?: Bitrix24ContactEmailRaw[];
  [key: string]: unknown;
};

export type Bitrix24RequisiteRaw = {
  ID?: string;
  ENTITY_TYPE_ID?: string;
  ENTITY_ID?: string;
  RQ_INN?: string;
  RQ_ADDR?: string;
  RQ_ZIP?: string;
  RQ_CITY?: string;
  RQ_COUNTRY?: string;
  [key: string]: unknown;
};

export type Bitrix24ProductRowRaw = {
  ID: string;
  PRODUCT_NAME?: string;
  QUANTITY?: string | number;
  PRICE?: string | number;
  [key: string]: unknown;
};

export type Bitrix24RequisiteListResult = Bitrix24RequisiteRaw[];

export type Bitrix24AddressRaw = {
  TYPE_ID?: string;
  ENTITY_TYPE_ID?: string;
  ENTITY_ID?: string;
  ANCHOR_TYPE_ID?: string;
  ANCHOR_ID?: string;
  ADDRESS_1?: string;
  ADDRESS_2?: string;
  CITY?: string;
  POSTAL_CODE?: string;
  REGION?: string;
  PROVINCE?: string;
  COUNTRY?: string;
  COUNTRY_CODE?: string;
  [key: string]: unknown;
};

export type Bitrix24AddressListResult = Bitrix24AddressRaw[];

export type Bitrix24ProductRowsListResult = Bitrix24ProductRowRaw[];
