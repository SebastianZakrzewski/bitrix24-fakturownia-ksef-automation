INSERT INTO "fakturownia-ksef-invoices".client_configs (
  name,
  bitrix_paid_stage_id,
  bitrix_field_mapping,
  invoice_type_mapping,
  default_vat_rate,
  default_currency,
  default_unit,
  is_active
)
SELECT
  'Evapremium V1',
  'PREPARATION',
  '{"invoiceDocumentTypeField":"UF_CRM_1776810914892","invoiceDocumentTypeFinalValueId":"1328","invoiceDocumentTypeCorrectionValueId":"1330","paymentFormField":"UF_CRM_1764595962462","paymentFormFullValueId":"718","paymentFormAdvanceValueId":"720","advanceAmountField":"UF_CRM_1764863464851","documentTypeField":"UF_CRM_1764599187558","documentTypeInvoiceValueId":"722","invoiceLinkField":"UF_CRM_1776642959143","dealTotalField":"OPPORTUNITY","mainProductName":"Dywaniki Evapremium","mainProductUnit":"szt.","mainProductPriceStrategy":"OPPORTUNITY_MINUS_PRODUCT_ROWS","shippingCostField":"UF_CRM_1764865232643","shippingProductName":"Wysyłka","companyAddressSource":"CRM_ADDRESS_LIST"}'::jsonb,
  '{}'::jsonb,
  23,
  'PLN',
  'szt.',
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM "fakturownia-ksef-invoices".client_configs
  WHERE is_active = true
);
