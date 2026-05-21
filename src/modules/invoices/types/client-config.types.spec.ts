import {
  EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS,
} from '../config/evapremium-v1-client-config';
import {
  isClientBitrixFieldMapping,
  isClientInvoiceTypeMapping,
} from './client-config.types';

describe('Evapremium V1 client config mappings', () => {
  it('defines a valid bitrix_field_mapping shape', () => {
    expect(
      isClientBitrixFieldMapping(
        EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping,
      ),
    ).toBe(true);
  });

  it('defines a valid invoice_type_mapping shape', () => {
    expect(
      isClientInvoiceTypeMapping(
        EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.invoice_type_mapping,
      ),
    ).toBe(true);
  });

  it('uses paid stage PREPARATION (Oplacone on Evapremium portal)', () => {
    expect(EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_paid_stage_id).toBe(
      'PREPARATION',
    );
  });

  it('maps invoice document type field for FINAL (Dopełniająca)', () => {
    const mapping = EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping;

    expect(mapping.invoiceDocumentTypeField).toBe('UF_CRM_1776810914892');
    expect(mapping.invoiceDocumentTypeFinalValueId).toBe('1328');
    expect(mapping.invoiceDocumentTypeCorrectionValueId).toBe('1330');
  });

  it('maps payment form field separately from invoice document type', () => {
    const mapping = EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping;

    expect(mapping.paymentFormField).toBe('UF_CRM_1764595962462');
    expect(mapping.paymentFormFullValueId).toBe('718');
    expect(mapping.paymentFormAdvanceValueId).toBe('720');
  });

  it('standardizes main product name', () => {
    expect(
      EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping.mainProductName,
    ).toBe('Dywaniki Evapremium');
  });
});
