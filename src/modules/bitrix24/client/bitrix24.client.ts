import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../config/env.validation';
import { Bitrix24ApiError } from '../errors/bitrix24.errors';
import type { Bitrix24Operation } from '../errors/bitrix24.errors';
import type {
  Bitrix24ApiErrorPayload,
  Bitrix24ApiResponse,
} from '../types/bitrix24-api.types';

export type Bitrix24FetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

@Injectable()
export class Bitrix24Client {
  private readonly webhookBaseUrl?: string;
  private readonly fetchFn: Bitrix24FetchFn;

  constructor(
    configService: ConfigService<AppEnv, true>,
    fetchFn: Bitrix24FetchFn = fetch,
  ) {
    this.webhookBaseUrl = configService.get('BITRIX24_WEBHOOK_URL', {
      infer: true,
    });
    this.fetchFn = fetchFn;
  }

  async call<T>(
    operation: Bitrix24Operation,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.webhookBaseUrl) {
      throw new Bitrix24ApiError({
        operation,
        method,
        message: 'BITRIX24_WEBHOOK_URL is not configured',
      });
    }

    const url = `${this.webhookBaseUrl.replace(/\/$/, '')}/${method}.json`;
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params ?? {}),
    });

    const body = (await response.json()) as Bitrix24ApiResponse<T> &
      Bitrix24ApiErrorPayload;

    if (!response.ok) {
      throw new Bitrix24ApiError({
        operation,
        method,
        message: `Bitrix24 HTTP ${response.status}`,
        httpStatus: response.status,
        bitrixErrorCode: body.error,
        bitrixErrorDescription: body.error_description,
      });
    }

    if ('error' in body && body.error) {
      throw new Bitrix24ApiError({
        operation,
        method,
        message: body.error_description ?? body.error,
        httpStatus: response.status,
        bitrixErrorCode: body.error,
        bitrixErrorDescription: body.error_description,
      });
    }

    return body.result;
  }
}
