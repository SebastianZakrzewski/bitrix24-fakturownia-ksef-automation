import type { ClientConfigMappings } from '../types/client-config.types';

/**
 * Canonical Evapremium V1 client_config mapping (Bitrix24 evapremium.bitrix24.pl).
 *
 * Invoice type resolution (operator workflow):
 * 1. ADVANCE: forma płatności = Zaliczka (720), typ faktury pusty.
 * 2. FINAL (dopełniająca): typ faktury = Dopełniająca (1328),
 *    forma płatności zmieniona na Pełna Płatność (718), etap ponownie Oplacone (PREPARATION).
 * 3. FULL: forma płatności = Pełna Płatność (718), typ faktury nie jest Dopełniająca/Korygująca.
 */
export const EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS: ClientConfigMappings = {
  bitrix_paid_stage_id: 'PREPARATION',

  bitrix_field_mapping: {
    invoiceDocumentTypeField: 'UF_CRM_1776810914892',
    invoiceDocumentTypeFinalValueId: '1328',
    invoiceDocumentTypeCorrectionValueId: '1330',
    paymentFormField: 'UF_CRM_1764595962462',
    paymentFormFullValueId: '718',
    paymentFormAdvanceValueId: '720',
    advanceAmountField: 'UF_CRM_1764863464851',
    documentTypeField: 'UF_CRM_1764599187558',
    documentTypeInvoiceValueId: '722',
    invoiceLinkField: 'UF_CRM_1776642959143',
    dealTotalField: 'OPPORTUNITY',
    mainProductName: 'Dywaniki Evapremium',
    mainProductUnit: 'szt.',
    mainProductPriceStrategy: 'OPPORTUNITY_MINUS_PRODUCT_ROWS',
    shippingCostField: 'UF_CRM_1764865232643',
    shippingProductName: 'Wysyłka',
    companyAddressSource: 'CRM_ADDRESS_LIST',
  },

  /** Legacy column; resolution uses bitrix_field_mapping value IDs in Task 6. */
  invoice_type_mapping: {},
};

export const EVAPREMIUM_V1_CLIENT_CONFIG_NAME = 'Evapremium V1';
