/**
 * Evapremium V1 Bitrix field IDs for live-test setup only.
 * Mirrors `src/modules/invoices/config/evapremium-v1-client-config.ts` without importing `src/`.
 */
export const EVAPREMIUM_BITRIX_PAID_STAGE_ID = 'PREPARATION';

export const EVAPREMIUM_BITRIX_FIELD_MAPPING = {
  invoiceDocumentTypeField: 'UF_CRM_1776810914892',
  invoiceDocumentTypeFinalValueId: '1328',
  invoiceDocumentTypeCorrectionValueId: '1330',
  paymentFormField: 'UF_CRM_1764595962462',
  paymentFormFullValueId: '718',
  paymentFormAdvanceValueId: '720',
  documentTypeField: 'UF_CRM_1764599187558',
  documentTypeInvoiceValueId: '722',
  shippingCostField: 'UF_CRM_1764865232643',
  advanceAmountField: 'UF_CRM_1764863464851',
  mainProductName: 'Dywaniki Evapremium',
  companyAddressSource: 'CRM_ADDRESS_LIST' as const,
};
