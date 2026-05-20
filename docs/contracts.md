# Contracts V1

## n8n request DTO
```ts
type BitrixTriggerRequestDto = {
  bitrix_deal_id: string;
  trigger_source: 'BITRIX24_STAGE_CHANGE';
  trigger_stage_id: string;
  triggered_at: string;
};
```

## Use case command
```ts
type CreateInvoiceFromBitrixDealCommand = {
  bitrixDealId: string;
  triggerSource: 'BITRIX24_STAGE_CHANGE';
  triggerStageId: string;
  triggeredAt: string;
};
```

DTO is HTTP input. Command is use-case input after controller validation and mapping.

## Trigger response DTO
```ts
type InvoiceProcessTriggerResponseDto = {
  process_id?: string;
  status:
    | 'TRIGGER_RECEIVED'
    | 'VALIDATION_FAILED'
    | 'INVOICE_CREATION_IN_PROGRESS'
    | 'FAKTUROWNIA_ERROR'
    | 'UNKNOWN_AFTER_TIMEOUT'
    | 'INVOICE_CREATED'
    | 'KSEF_SUBMISSION_CONFIRMED'
    | 'KSEF_SUBMISSION_ERROR'
    | 'KSEF_STATUS_UNKNOWN'
    | 'MANUAL_REVIEW_REQUIRED'
    | 'COMPLETED'
    | 'STALE_TRIGGER_IGNORED';
  bitrix_deal_id: string;
  invoice_type?: 'FULL' | 'ADVANCE' | 'FINAL';
  message: string;
};
```

`process_id` is optional because stale triggers do not create an `InvoiceProcess`.

## Client panel list DTO
```ts
type ClientInvoiceProcessListItemDto = {
  process_id: string;
  bitrix_deal_id: string;
  bitrix_deal_url?: string;
  invoice_type: 'FULL' | 'ADVANCE' | 'FINAL';
  status: InvoiceProcessStatus;
  fakturownia_invoice_url?: string;
  total_gross?: number;
  currency: 'PLN';
  last_error_message?: string;
  created_at: string;
  completed_at?: string;
};
```

## Technical retry DTOs
```ts
type TechnicalRetryRequestDto = {
  reason: string;
  requested_by: string;
  target_action:
    | 'RETRY_VALIDATION_AND_PROCESS'
    | 'RETRY_FAKTUROWNIA_CREATION'
    | 'RETRY_BITRIX_SYNC';
};
```

```ts
type TechnicalRetryResponseDto = {
  retry_attempt_id: string;
  invoice_process_id: string;
  allowed: boolean;
  blocked_reason?: string;
  resulting_status?: InvoiceProcessStatus;
  message: string;
};
```

Retry endpoint always records the attempt. If `allowed=false`, no side effect is executed.

## Bitrix24 integration types
```ts
type BitrixDealData = {
  dealId: string;
  dealUrl?: string;
  stageId: string;
  companyId?: string;
  customFields: Record<string, unknown>;
  productRows: BitrixProductRow[];
};

type BitrixCompanyData = {
  companyId: string;
  name?: string;
  nip?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

type BitrixProductRow = {
  id: string;
  productName?: string;
  quantity?: number;
  grossPrice?: number;
};
```

These are integration DTOs. `BitrixInvoiceMapper` maps them with `ClientConfig` to internal invoice models.

## Fakturownia integration result
```ts
type FakturowniaCreateInvoiceResult = {
  fakturowniaInvoiceId: string;
  fakturowniaInvoiceUrl: string;
  totalNet: number;
  totalGross: number;
  currency: 'PLN';
  ksefStatus?: 'SUBMISSION_CONFIRMED' | 'SUBMISSION_ERROR' | 'STATUS_UNKNOWN';
  ksefRawStatus?: string;
};
```

This is an integration type in `modules/invoices/integrations/fakturownia`, not a domain type.

## ValidationError
```ts
type ValidationError = {
  code:
    | 'MISSING_INVOICE_TYPE'
    | 'MISSING_COMPANY'
    | 'MISSING_NIP'
    | 'MISSING_COMPANY_NAME'
    | 'MISSING_COMPANY_ADDRESS'
    | 'MISSING_PRODUCTS'
    | 'INVALID_PRODUCT_LINE'
    | 'MISSING_ADVANCE_AMOUNT'
    | 'INVALID_ADVANCE_AMOUNT'
    | 'MISSING_PREVIOUS_ADVANCE_INVOICE'
    | 'DUPLICATE_INVOICE'
    | 'DEAL_NOT_IN_PAID_STAGE';
  message: string;
  field?: string;
  source?: 'BITRIX_DEAL' | 'BITRIX_COMPANY' | 'PRODUCT_MAPPING' | 'INVOICE_RULE';
};
```
