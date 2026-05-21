import type { InjectionToken } from '@nestjs/common';

export type Bitrix24FetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export const BITRIX24_HTTP_CLIENT = Symbol(
  'BITRIX24_HTTP_CLIENT',
) as InjectionToken<Bitrix24FetchFn>;
