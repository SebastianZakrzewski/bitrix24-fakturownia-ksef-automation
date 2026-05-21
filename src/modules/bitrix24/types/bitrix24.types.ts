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

export type BitrixDealCore = {
  dealId: string;
  dealUrl?: string;
  stageId: string;
  companyId?: string;
  customFields: Record<string, unknown>;
};

export type BitrixTimelineCommentParams = {
  dealId: string;
  message: string;
};

export type BitrixDealFieldUpdateParams = {
  dealId: string;
  fieldCode: string;
  value: string;
};

export type BitrixCompanyAddressSource = 'CRM_ADDRESS_LIST' | 'REQUISITE';

export type Bitrix24GetCompanyOptions = {
  addressSource?: BitrixCompanyAddressSource;
};
