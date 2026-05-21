import { Injectable } from '@nestjs/common';
import {
  FakturowniaApiError,
  type FakturowniaErrorCategory,
} from './fakturownia.errors';
import { isFakturowniaHttpFailure } from './fakturownia.client';

@Injectable()
export class FakturowniaErrorMapper {
  map(error: unknown): FakturowniaApiError {
    if (error instanceof FakturowniaApiError) {
      return error;
    }

    if (isFakturowniaHttpFailure(error)) {
      return new FakturowniaApiError({
        category: this.categoryFromHttpStatus(error.httpStatus),
        message: this.extractHttpMessage(error.httpStatus, error.body),
        httpStatus: error.httpStatus,
        responseBody: error.body,
      });
    }

    if (this.isTimeoutError(error)) {
      return new FakturowniaApiError({
        category: 'TIMEOUT',
        message: this.extractMessage(error, 'Fakturownia request timed out'),
      });
    }

    return new FakturowniaApiError({
      category: 'UNKNOWN',
      message: this.extractMessage(error, 'Unknown Fakturownia error'),
    });
  }

  private categoryFromHttpStatus(status: number): FakturowniaErrorCategory {
    if (status >= 400 && status <= 499) {
      return 'CLIENT';
    }

    if (status >= 500 && status <= 599) {
      return 'SERVER';
    }

    return 'UNKNOWN';
  }

  private isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.name === 'AbortError' ||
        error.name === 'TimeoutError' ||
        error.message.toLowerCase().includes('timeout')
      );
    }

    return false;
  }

  private extractHttpMessage(status: number, body: unknown): string {
    const bodyMessage = this.extractBodyMessage(body);

    if (bodyMessage) {
      return `Fakturownia HTTP ${status}: ${bodyMessage}`;
    }

    return `Fakturownia HTTP ${status}`;
  }

  private extractBodyMessage(body: unknown): string | undefined {
    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (typeof body !== 'object' || body === null) {
      return undefined;
    }

    const record = body as Record<string, unknown>;
    const candidates = [record.message, record.error, record.error_message];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }

    return undefined;
  }

  private extractMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }
}
