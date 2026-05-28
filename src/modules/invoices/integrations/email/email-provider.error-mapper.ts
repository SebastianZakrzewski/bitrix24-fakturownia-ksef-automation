import { Injectable } from '@nestjs/common';
import { EmailProviderApiError } from './email.errors';
import { isEmailHttpFailure } from './n8n-email-webhook.client';

@Injectable()
export class EmailProviderErrorMapper {
  map(error: unknown): EmailProviderApiError {
    if (error instanceof EmailProviderApiError) {
      return error;
    }

    if (isEmailHttpFailure(error)) {
      return new EmailProviderApiError({
        category: this.categoryFromHttpStatus(error.httpStatus),
        message: this.extractHttpMessage(error.httpStatus, error.body),
        httpStatus: error.httpStatus,
        responseBody: error.body,
      });
    }

    if (this.isTimeoutError(error)) {
      return new EmailProviderApiError({
        category: 'TIMEOUT',
        message: this.extractMessage(error, 'Invoice email webhook request timed out'),
      });
    }

    return new EmailProviderApiError({
      category: 'UNKNOWN',
      message: this.extractMessage(error, 'Unknown invoice email provider error'),
    });
  }

  private categoryFromHttpStatus(status: number): EmailProviderApiError['category'] {
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
      return `Invoice email webhook HTTP ${status}: ${bodyMessage}`;
    }

    return `Invoice email webhook HTTP ${status}`;
  }

  private extractBodyMessage(body: unknown): string | undefined {
    if (typeof body === 'string' && body.trim()) {
      return body;
    }

    if (typeof body !== 'object' || body === null) {
      return undefined;
    }

    const record = body as Record<string, unknown>;
    const candidates = [
      record.error_message,
      record.message,
      record.error,
    ];

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
