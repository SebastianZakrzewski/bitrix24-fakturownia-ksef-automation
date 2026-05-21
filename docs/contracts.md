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

## ClientConfig Bitrix mapping (Evapremium V1)

Canonical source: `src/modules/invoices/config/evapremium-v1-client-config.ts`.

```ts
type ClientBitrixFieldMapping = {
  invoiceDocumentTypeField: string;              // UF_CRM_1776810914892
  invoiceDocumentTypeFinalValueId: string;       // '1328' = Dopełniająca → FINAL
  invoiceDocumentTypeCorrectionValueId: string; // '1330' = Korygująca (block V1)
  paymentFormField: string;                      // UF_CRM_1764595962462
  paymentFormFullValueId: string;                // '718' = Pełna Płatność
  paymentFormAdvanceValueId: string;             // '720' = Zaliczka
  advanceAmountField: string;
  documentTypeField: string;
  documentTypeInvoiceValueId: string;            // '722' = Faktura only
  invoiceLinkField: string;
  dealTotalField: 'OPPORTUNITY';
  mainProductName: string;
  mainProductUnit: string;
  mainProductPriceStrategy: 'OPPORTUNITY_MINUS_PRODUCT_ROWS';
  companyAddressSource: 'CRM_ADDRESS_LIST' | 'REQUISITE';
};

// bitrix_paid_stage_id: 'PREPARATION' (etap „Oplacone”)
```

Invoice type resolution (Evapremium operator workflow):
- `ADVANCE`: `paymentForm` = Zaliczka (720), `invoiceDocumentType` empty.
- `FINAL`: `invoiceDocumentType` = Dopełniająca (1328), then `paymentForm` = Pełna Płatność (718), stage again `PREPARATION`.
- `FULL`: `paymentForm` = Pełna Płatność (718), `invoiceDocumentType` not Dopełniająca/Korygująca.

### Bitrix trigger timing vs `FINAL` (V1)

V1 trigger contract: Bitrix24 automation on **paid stage change** (`BITRIX24_STAGE_CHANGE` → `bitrix_paid_stage_id` = `PREPARATION`). n8n forwards only `bitrix_deal_id` and trigger metadata; backend loads **current** deal fields from Bitrix24.

Operator order for `FINAL` (before re-entering paid stage):
1. Set `invoiceDocumentType` = Dopełniająca (`1328`).
2. Set `paymentForm` = Pełna Płatność (`718`) — was Zaliczka (`720`) after advance invoice.
3. Move deal to paid stage `PREPARATION` again → webhook fires.

Expected deal state when the webhook is processed for a successful `FINAL` claim:
- `stageId` = `PREPARATION`
- `invoiceDocumentType` = `1328` **and** `paymentForm` = `718`
- `documentType` = Faktura (`722`)
- prior successful `ADVANCE` process for the same `bitrix_deal_id` in our DB

| Situation at webhook processing | Backend behavior | Creates `InvoiceProcess`? |
|---|---|---|
| `stageId` ≠ `PREPARATION` (deal no longer paid) | `STALE_TRIGGER_IGNORED` event only | No |
| `stageId` = `PREPARATION`, `1328` + `718` (+ other rules pass) | Map `FINAL`, claim `deal_id:FINAL`, continue workflow | Yes (if not duplicate) |
| `stageId` = `PREPARATION`, `1328` but `paymentForm` still `720` | Do **not** map `FINAL`; validation fails (`MISSING_INVOICE_TYPE` or equivalent). No Fakturownia side effect. | Only if implementation claims before validation — prefer validate before claim |
| `stageId` = `PREPARATION`, `718` without `1328` | Map `FULL` (first full invoice), not `FINAL` | Per `FULL` rules |
| Operator fixes CRM (step 2), then paid stage triggers again | Normal new trigger; `FINAL` when `1328` + `718` + `PREPARATION` | Yes |

Rules:
- **`STALE_TRIGGER_IGNORED`** applies only to **paid-stage mismatch** (trigger assumed paid stage, deal is not on `PREPARATION` anymore). It does **not** apply to incomplete UF combinations (e.g. Dopełniająca without Pełna Płatność).
- Incomplete `FINAL` prerequisites (e.g. `1328` + `720` on paid stage) are **`VALIDATION_FAILED`** (or rejected before process claim), not `STALE`.
- `STALE_TRIGGER_IGNORED` and failed validation **do not block** a later successful trigger after the operator completes fields and re-enters paid stage (`domain-lifecycle.md`).

If Bitrix automation is later configured to fire on UF changes (not only stage), the same rules apply: backend always reads current deal state; `FINAL` only when `1328` + `718` + `PREPARATION` (+ DB advance check).

Product rules:
- Main invoice line is always `mainProductName` (not CRM mat/car UF fields).
- Additional lines come from Bitrix `productRows` only.
- Main line gross = `OPPORTUNITY` minus sum of product row gross amounts; if no rows, main line = full `OPPORTUNITY`.

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
