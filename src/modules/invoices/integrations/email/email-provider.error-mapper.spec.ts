import { EmailProviderApiError } from './email.errors';
import { EmailProviderErrorMapper } from './email-provider.error-mapper';

describe('EmailProviderErrorMapper', () => {
  const mapper = new EmailProviderErrorMapper();

  it('maps HTTP 4xx failures to CLIENT category', () => {
    const error = mapper.map({
      httpStatus: 422,
      body: { error_message: 'Invalid recipient' },
    });

    expect(error).toMatchObject({
      category: 'CLIENT',
      httpStatus: 422,
    });
  });

  it('maps timeout failures to TIMEOUT category', () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'AbortError';

    const error = mapper.map(timeoutError);

    expect(error.category).toBe('TIMEOUT');
  });

  it('preserves EmailProviderApiError instances', () => {
    const original = new EmailProviderApiError({
      category: 'UNKNOWN',
      message: 'Already mapped',
    });

    expect(mapper.map(original)).toBe(original);
  });
});
