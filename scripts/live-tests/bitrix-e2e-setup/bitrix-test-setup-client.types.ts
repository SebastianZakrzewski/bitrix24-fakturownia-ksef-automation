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

export interface BitrixTestSetupClient {
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
