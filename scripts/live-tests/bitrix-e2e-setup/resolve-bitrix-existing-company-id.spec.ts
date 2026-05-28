import { resolveBitrixExistingCompanyId } from './resolve-bitrix-existing-company-id';

describe('resolveBitrixExistingCompanyId', () => {
  it('returns configured company id from env', () => {
    expect(
      resolveBitrixExistingCompanyId({
        LIVE_TEST_BITRIX_EXISTING_COMPANY_ID: '12345',
      }),
    ).toEqual({ configured: true, companyId: '12345' });
  });

  it('returns not configured when id is missing or invalid', () => {
    expect(resolveBitrixExistingCompanyId({})).toEqual({ configured: false });
    expect(
      resolveBitrixExistingCompanyId({
        LIVE_TEST_BITRIX_EXISTING_COMPANY_ID: 'not-numeric',
      }),
    ).toEqual({ configured: false });
  });
});
