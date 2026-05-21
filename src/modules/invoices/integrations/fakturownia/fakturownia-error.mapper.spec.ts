import { FakturowniaErrorMapper } from './fakturownia-error.mapper';
import { FakturowniaApiError } from './fakturownia.errors';
import {
  fakturowniaClientErrorBodyFixture,
  fakturowniaServerErrorBodyFixture,
} from './testing/fakturownia.fixtures';

describe('FakturowniaErrorMapper', () => {
  const mapper = new FakturowniaErrorMapper();

  it('maps 4xx HTTP failure to CLIENT category', () => {
    const error = mapper.map({
      httpStatus: 422,
      body: fakturowniaClientErrorBodyFixture(),
    });

    expect(error).toMatchObject({
      name: 'FakturowniaApiError',
      category: 'CLIENT',
      httpStatus: 422,
      message: 'Fakturownia HTTP 422: Invalid buyer tax number',
    });
  });

  it('maps 5xx HTTP failure to SERVER category', () => {
    const error = mapper.map({
      httpStatus: 503,
      body: fakturowniaServerErrorBodyFixture(),
    });

    expect(error).toMatchObject({
      category: 'SERVER',
      httpStatus: 503,
      message: 'Fakturownia HTTP 503: Internal server error',
    });
  });

  it('maps AbortError to TIMEOUT category', () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const error = mapper.map(abortError);

    expect(error).toMatchObject({
      category: 'TIMEOUT',
      message: 'The operation was aborted',
    });
  });

  it('maps generic errors to UNKNOWN category', () => {
    const error = mapper.map(new Error('Network unreachable'));

    expect(error).toMatchObject({
      category: 'UNKNOWN',
      message: 'Network unreachable',
    });
  });

  it('passes through existing FakturowniaApiError', () => {
    const original = new FakturowniaApiError({
      category: 'UNKNOWN',
      message: 'FAKTUROWNIA_BASE_URL is not configured',
    });

    expect(mapper.map(original)).toBe(original);
  });
});
