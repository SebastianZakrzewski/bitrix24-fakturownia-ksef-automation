export interface ResolvedBitrixExistingCompany {
  configured: boolean;
  companyId?: string;
}

export function resolveBitrixExistingCompanyId(
  config: Record<string, string | undefined> = process.env,
): ResolvedBitrixExistingCompany {
  const companyId = config.LIVE_TEST_BITRIX_EXISTING_COMPANY_ID?.trim();

  if (!companyId) {
    return { configured: false };
  }

  if (!/^\d+$/.test(companyId)) {
    return { configured: false };
  }

  return { configured: true, companyId };
}
