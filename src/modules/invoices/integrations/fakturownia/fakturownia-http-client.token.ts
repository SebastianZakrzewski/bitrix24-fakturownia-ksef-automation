import type { InjectionToken } from '@nestjs/common';

export type FakturowniaFetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export const FAKTUROWNIA_HTTP_CLIENT = Symbol(
  'FAKTUROWNIA_HTTP_CLIENT',
) as InjectionToken<FakturowniaFetchFn>;
