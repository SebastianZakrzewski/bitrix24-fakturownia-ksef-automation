export type BitrixProductRow = {
  id: string;
  productName?: string;
  quantity?: number;
  grossPrice?: number;
};

export type BitrixDealData = {
  dealId: string;
  dealUrl?: string;
  stageId: string;
  companyId?: string;
  customFields: Record<string, unknown>;
  productRows: BitrixProductRow[];
};

export type BitrixCompanyData = {
  companyId: string;
  name?: string;
  nip?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};
