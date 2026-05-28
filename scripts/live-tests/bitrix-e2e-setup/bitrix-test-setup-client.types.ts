export interface BitrixTestCompanyInput {
  title: string;
  nip: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface BitrixTestCompanyResult {
  companyId: string;
}

export interface BitrixTestDealProductRowInput {
  productName: string;
  quantity: number;
  price: number;
}

export interface BitrixTestDealInput {
  title: string;
  companyId: string;
  stageId: string;
  opportunity: number;
  customFields: Record<string, string | number>;
  productRows: BitrixTestDealProductRowInput[];
}

export interface BitrixTestDealResult {
  dealId: string;
}

export interface BitrixTestCompanyAddressInput {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface BitrixTestCompanyAddressEnsureResult {
  companyId: string;
  addressAlreadyPresent: boolean;
  addressAdded: boolean;
}

export interface BitrixTestCompanyRequisiteEnsureResult {
  companyId: string;
  requisiteId?: string;
  nipAlreadyValid: boolean;
  nipUpdated: boolean;
}

export interface BitrixTestSetupClient {
  /** Reuses CRM company with existing NIP/requisites; does not call requisite.add or address.add. */
  useExistingTestCompany(companyId: string): Promise<BitrixTestCompanyResult>;
  /**
   * Ensures crm.address.list has a complete address for Evapremium CRM_ADDRESS_LIST mapping.
   * Adds address only when street/postal/city/country are missing.
   */
  ensureExistingTestCompanyAddress(
    companyId: string,
    address: BitrixTestCompanyAddressInput,
  ): Promise<BitrixTestCompanyAddressEnsureResult>;
  /**
   * Ensures company requisite has a valid NIP for Fakturownia ADVANCE/FINAL.
   * Updates crm.requisite when RQ_INN differs from the configured test NIP.
   */
  ensureExistingTestCompanyRequisite(
    companyId: string,
    nip: string,
  ): Promise<BitrixTestCompanyRequisiteEnsureResult>;
  /** @internal Used only by REST method coverage tests — not the live E2E setup path. */
  createTestCompany(input: BitrixTestCompanyInput): Promise<BitrixTestCompanyResult>;
  createTestDeal(input: BitrixTestDealInput): Promise<BitrixTestDealResult>;
  updateTestDeal(
    dealId: string,
    fields: Record<string, string | number>,
  ): Promise<void>;
  setDealStage(dealId: string, stageId: string): Promise<void>;
}

export type BitrixRestCallFn = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<unknown>;
