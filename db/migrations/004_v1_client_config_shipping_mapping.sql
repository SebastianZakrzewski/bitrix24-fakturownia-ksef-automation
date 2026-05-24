-- Evapremium V1: add shipping cost field mapping to active client_configs.
-- shippingCostField = UF „Dostawa” (brutto); shippingProductName = invoice line label.

UPDATE "fakturownia-ksef-invoices".client_configs
SET
  bitrix_field_mapping = bitrix_field_mapping
    || '{
      "shippingCostField": "UF_CRM_1764865232643",
      "shippingProductName": "Wysyłka"
    }'::jsonb,
  updated_at = now()
WHERE is_active = true
  AND NOT (bitrix_field_mapping ? 'shippingCostField');
