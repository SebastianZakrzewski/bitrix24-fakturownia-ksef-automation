import type { InvoiceType } from './invoice.types';

/**
 * Bitrix24 deal field codes for Evapremium V1.
 * Verified against evapremium.bitrix24.pl (deals 27000, 27414, crm.deal.fields).
 */
export type ClientBitrixFieldMapping = {
  /**
   * UF typ faktury: Dopełniająca / Korygująca (osobne od formy płatności).
   * FINAL: ustawić Dopełniająca, potem formę płatności na Pełna Płatność, etap Oplacone.
   */
  invoiceDocumentTypeField: string;
  /** Bitrix enum ID „Dopełniająca” → InvoiceType FINAL */
  invoiceDocumentTypeFinalValueId: string;
  /** Bitrix enum ID „Korygująca” — poza V1 (blokada w walidacji) */
  invoiceDocumentTypeCorrectionValueId: string;
  /** UF forma płatności: Pełna Płatność / Zaliczka */
  paymentFormField: string;
  /** 718 = Pełna Płatność */
  paymentFormFullValueId: string;
  /** 720 = Zaliczka */
  paymentFormAdvanceValueId: string;
  /** UF: kwota zaliczki (ADVANCE) */
  advanceAmountField: string;
  /** UF: Faktura / Paragon — gate before invoice process */
  documentTypeField: string;
  /** Bitrix enum ID for „Faktura” (722 on Evapremium) */
  documentTypeInvoiceValueId: string;
  /** UF: link do faktury na dealu (sync po Fakturownia) */
  invoiceLinkField: string;
  /** Standardowe pole: suma deala — cena linii „Dywaniki Evapremium” */
  dealTotalField: 'OPPORTUNITY';
  /** Stała nazwa produktu głównego na fakturze */
  mainProductName: string;
  /** Jednostka produktu głównego (zgodna z default_unit) */
  mainProductUnit: string;
  /**
   * OPPORTUNITY_MINUS_PRODUCT_ROWS: cena głównej = OPPORTUNITY − suma(product rows) − koszt dostawy;
   * gdy brak wierszy → OPPORTUNITY − koszt dostawy na główną linię; dostawa jako osobna pozycja.
   */
  mainProductPriceStrategy: 'OPPORTUNITY_MINUS_PRODUCT_ROWS';
  /** UF: koszt dostawy / wysyłki (brutto) */
  shippingCostField: string;
  /** Nazwa pozycji faktury dla kosztu dostawy */
  shippingProductName: string;
  /**
   * Skąd czytać adres firmy: requisite RQ_* lub crm.address.list (Evapremium używa address.list).
   */
  companyAddressSource: 'CRM_ADDRESS_LIST' | 'REQUISITE';
};

/**
 * @deprecated V1 resolves invoice type from invoiceDocumentTypeField + paymentFormField value IDs.
 * Kept optional for DB rows; use empty object in new configs.
 */
export type ClientInvoiceTypeMapping = Partial<Record<string, InvoiceType>>;

export type ClientConfigMappings = {
  bitrix_paid_stage_id: string;
  bitrix_field_mapping: ClientBitrixFieldMapping;
  invoice_type_mapping: ClientInvoiceTypeMapping;
};

export function isClientBitrixFieldMapping(
  value: unknown,
): value is ClientBitrixFieldMapping {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const mapping = value as Record<string, unknown>;

  return (
    typeof mapping.invoiceDocumentTypeField === 'string' &&
    typeof mapping.invoiceDocumentTypeFinalValueId === 'string' &&
    typeof mapping.invoiceDocumentTypeCorrectionValueId === 'string' &&
    typeof mapping.paymentFormField === 'string' &&
    typeof mapping.paymentFormFullValueId === 'string' &&
    typeof mapping.paymentFormAdvanceValueId === 'string' &&
    typeof mapping.advanceAmountField === 'string' &&
    typeof mapping.documentTypeField === 'string' &&
    typeof mapping.documentTypeInvoiceValueId === 'string' &&
    typeof mapping.invoiceLinkField === 'string' &&
    mapping.dealTotalField === 'OPPORTUNITY' &&
    typeof mapping.mainProductName === 'string' &&
    typeof mapping.mainProductUnit === 'string' &&
    mapping.mainProductPriceStrategy === 'OPPORTUNITY_MINUS_PRODUCT_ROWS' &&
    typeof mapping.shippingCostField === 'string' &&
    typeof mapping.shippingProductName === 'string' &&
    (mapping.companyAddressSource === 'CRM_ADDRESS_LIST' ||
      mapping.companyAddressSource === 'REQUISITE')
  );
}

export function isClientInvoiceTypeMapping(
  value: unknown,
): value is ClientInvoiceTypeMapping {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const allowed: InvoiceType[] = ['FULL', 'ADVANCE', 'FINAL'];

  return Object.values(value as Record<string, unknown>).every(
    (entry) => typeof entry === 'string' && allowed.includes(entry as InvoiceType),
  );
}
