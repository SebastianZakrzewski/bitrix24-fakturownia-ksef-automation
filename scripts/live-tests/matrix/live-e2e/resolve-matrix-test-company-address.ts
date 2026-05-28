import type { LiveTestBuyerFixture } from '../../fixtures/scenario-context.types';
import type { BitrixTestCompanyInput } from '../../bitrix-e2e-setup/bitrix-test-setup-client.types';

/** Valid Polish NIP for Fakturownia ADVANCE/FINAL (checksum verified). */
export const MATRIX_LIVE_TEST_COMPANY_NIP_DEFAULT = '5261040828';

export function resolveMatrixTestCompanyBuyer(
  buyer: LiveTestBuyerFixture,
  rawConfig: Record<string, string | undefined> = process.env,
): Pick<
  BitrixTestCompanyInput,
  'street' | 'postalCode' | 'city' | 'country' | 'nip'
> {
  return {
    ...resolveMatrixTestCompanyAddress(buyer, rawConfig),
    nip:
      rawConfig.LIVE_TEST_BITRIX_COMPANY_NIP?.trim() ||
      MATRIX_LIVE_TEST_COMPANY_NIP_DEFAULT,
  };
}

export function resolveMatrixTestCompanyAddress(
  buyer: LiveTestBuyerFixture,
  rawConfig: Record<string, string | undefined> = process.env,
): Pick<
  BitrixTestCompanyInput,
  'street' | 'postalCode' | 'city' | 'country'
> {
  return {
    street:
      rawConfig.LIVE_TEST_BITRIX_COMPANY_STREET?.trim() || buyer.street,
    postalCode:
      rawConfig.LIVE_TEST_BITRIX_COMPANY_POSTAL_CODE?.trim() ||
      buyer.postalCode,
    city: rawConfig.LIVE_TEST_BITRIX_COMPANY_CITY?.trim() || buyer.city,
    country:
      rawConfig.LIVE_TEST_BITRIX_COMPANY_COUNTRY?.trim() || buyer.country,
  };
}

export function isMatrixCompanyBuyerEnsureEnabled(
  rawConfig: Record<string, string | undefined> = process.env,
): boolean {
  return rawConfig.LIVE_TEST_ALLOW_BITRIX_COMPANY_ADDRESS_ENSURE?.trim() === 'true';
}

/** @deprecated use isMatrixCompanyBuyerEnsureEnabled */
export function isMatrixCompanyAddressEnsureEnabled(
  rawConfig: Record<string, string | undefined> = process.env,
): boolean {
  return isMatrixCompanyBuyerEnsureEnabled(rawConfig);
}
