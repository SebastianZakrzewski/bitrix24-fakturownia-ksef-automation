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

## InvoiceEvent types (audit trail)

`invoice_events.event_type` is a plain text column. V1 accepted values:

```ts
type InvoiceEventType =
  | 'STALE_TRIGGER_IGNORED'
  | 'VALIDATION_FAILED';
```

| `event_type` | When recorded | `invoice_process_id` |
|---|---|---|
| `STALE_TRIGGER_IGNORED` | Deal no longer on paid stage at webhook processing | null (no process created) |
| `VALIDATION_FAILED` | Validation failed after process claim; errors stored on process | required (real process) |

Rules:

- `STALE_TRIGGER_IGNORED` is **not** an `InvoiceProcessStatus`.
- `VALIDATION_FAILED` as event type mirrors the resulting process status for audit; it is **not** a substitute for updating `invoice_processes.status`.
- Validation failure **before** process claim (e.g. unresolved invoice type) returns `VALIDATION_FAILED` response only — no `invoice_events` row.

## Client panel list DTO (V2 — deferred from V1)
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
    | 'RETRY_BITRIX_SYNC'
    | 'RETRY_INVOICE_EMAIL';
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
  contactId?: string;
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
  customerEmail?: string;
};

type BitrixProductRow = {
  id: string;
  productName?: string;
  quantity?: number;
  grossPrice?: number;
};
```

These are integration DTOs. `BitrixInvoiceMapper` maps them with `ClientConfig` to internal invoice models.

### Customer email source (Bitrix24)

V1 requires a valid customer-facing email before Fakturownia side effects.

**Accepted source (Evapremium V1):** deal-linked contact primary email.

| Step | Bitrix24 API / field | Maps to |
|---|---|---|
| 1 | `crm.deal.get` → `CONTACT_ID` | `BitrixDealCore.contactId` |
| 2 | `crm.contact.get` → `EMAIL[0].VALUE` (first multi-field entry) | `BitrixCompanyData.customerEmail` (via use case merge before `BitrixInvoiceMapper`) |
| 3 | `BitrixInvoiceMapper.mapBuyer` | `MappedBuyer.customerEmail` → validated `InvoiceDraft.buyer.customerEmail` |

Implementation:
- `Bitrix24ContactService.getPrimaryEmailByContactId(contactId)` — integration only; no business rules.
- `CreateInvoiceFromBitrixDealUseCase.resolveCompanyForInvoiceMapping` — when `dealCore.contactId` is set, loads contact email and sets `company.customerEmail` before mapping.
- Company UF / deal UF email fields are **not** used in V1.
- If `CONTACT_ID` is missing or contact has no `EMAIL` entries → `MISSING_CUSTOMER_EMAIL` at validation (`source: BITRIX_COMPANY`, `field: customerEmail`).

Rules:
- Email must pass format validation in `InvoiceValidationService`; invalid → `INVALID_CUSTOMER_EMAIL`.
- Email is normalized (`trim`, lowercase) in validated buyer before `InvoiceDraft` build.
- Verified on Evapremium portal: deal `29134`, contact `15532` (company `120` had no email value).

Task 11 (`InvoiceEmailService`) reuses validated `InvoiceDraft.buyer.customerEmail` as `recipientEmail`; no second Bitrix lookup at send time unless process is reloaded from snapshot.

## Invoice email delivery contract

Located in `modules/invoices/integrations/email` (provider) and `InvoiceEmailService` (orchestration). Types are **not** domain types.

### Internal send payload

```ts
type InvoiceEmailPayload = {
  processId: string;
  bitrixDealId: string;
  invoiceType: 'FULL' | 'ADVANCE' | 'FINAL';
  recipientEmail: string;
  recipientCompanyName: string;
  fakturowniaInvoiceId: string;
  fakturowniaInvoiceNumber: string;
  fakturowniaInvoiceUrl: string;
  pdfAttachment?: {
    filename: string;
    contentBase64: string;
    contentType: 'application/pdf';
  };
};
```

Rules:
- Built only after confirmed `FakturowniaCreateInvoiceResult`, required KSeF path for V1 success, and successful Bitrix timeline comment.
- PDF attachment is optional if provider/template uses link-only delivery; at least one of PDF or link must be present in the email body.
- PDF bytes come from Fakturownia (download URL/API — provider detail in integration task); not from Bitrix.
- `fakturowniaInvoiceNumber` matches the `number` sent to Fakturownia at create (from `FakturowniaInvoiceNumberService.allocate()`).

### n8n invoice email webhook request

`POST` to `N8N_INVOICE_EMAIL_WEBHOOK_URL` with header `X-Webhook-Secret: N8N_INVOICE_EMAIL_WEBHOOK_SECRET`.

```ts
type N8nInvoiceEmailWebhookRequest = {
  process_id: string;
  bitrix_deal_id: string;
  invoice_type: 'FULL' | 'ADVANCE' | 'FINAL';
  recipient_email: string;
  recipient_company_name: string;
  invoice_number: string; // e.g. 39/05/2026
  fakturownia_invoice_id: string;
  fakturownia_invoice_url: string;
  pdf_attachment?: {
    filename: string;
    content_base64: string;
    content_type: 'application/pdf';
  };
};
```

PDF `filename` uses a filesystem-safe form of `invoice_number` (e.g. `faktura-39-05-2026.pdf`).

### Delivery result

```ts
type InvoiceEmailDeliveryResult = {
  success: boolean;
  providerMessageId?: string;
  provider: string;
  sentAt: string;
  errorCode?: string;
  errorMessage?: string;
};
```

Rules:
- Persist delivery outcome in audit (`invoice_events` and/or process fields when implemented).
- `success: true` required before `COMPLETED`.
- Integration returns result only; use case decides status transition.

### Integration error categories

| Category | Condition | Use-case status |
|---|---|---|
| `CLIENT` | HTTP 4xx, invalid recipient, template/config error | `MANUAL_REVIEW_REQUIRED` |
| `SERVER` | HTTP 5xx | `MANUAL_REVIEW_REQUIRED`, no auto retry |
| `TIMEOUT` | Request timeout | `MANUAL_REVIEW_REQUIRED`, manual verification |
| `UNKNOWN` | Other failures | `MANUAL_REVIEW_REQUIRED` |

## ClientConfig Bitrix mapping (Evapremium V1)

Canonical source: `src/modules/invoices/config/evapremium-v1-client-config.ts`.

Runtime loads `bitrix_field_mapping` from active `client_configs` row — it must include `shippingCostField` and `shippingProductName` (same values as canonical config) or shipping will be treated as zero.

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
  shippingCostField: string;                     // UF_CRM_1764865232643 (Evapremium: „Dostawa”, brutto)
  shippingProductName: string;                   // 'Wysyłka' — nazwa pozycji na fakturze
  companyAddressSource: 'CRM_ADDRESS_LIST' | 'REQUISITE';
};

// bitrix_paid_stage_id: 'PREPARATION' (etap „Oplacone”)
```

When `companyAddressSource = 'CRM_ADDRESS_LIST'` (Evapremium V1), `Bitrix24CompanyService` loads buyer address from `crm.address.list` (`ENTITY_TYPE_ID=4`, `ENTITY_ID=companyId`). NIP remains from `crm.requisite.list`. When `REQUISITE`, address fields come from requisite `RQ_*` with fallback to `crm.company.get` address columns.

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
- Additional lines come from Bitrix `productRows`.
- Shipping cost comes from `shippingCostField` on the deal; when **> 0**, mapped as a separate `ProductLine` with `shippingProductName` (Evapremium V1: „Wysyłka”).
- Main line gross = `OPPORTUNITY` minus sum of product row gross amounts minus shipping cost; if no rows, main line = `OPPORTUNITY` minus shipping cost.
- Shipping is **not** a dedicated Fakturownia API field — it is sent as a normal `positions[]` item (`name`, `quantity`, `tax`, `total_price_gross`).
- Zero or missing shipping cost omits the shipping line (no validation error).

## Fakturownia integration contract

Located in `modules/invoices/integrations/fakturownia`. Integration types are **not** domain types.

Rules:
- Input is only validated `InvoiceDraft` (see `domain-lifecycle.md`). No raw Bitrix payload.
- `FakturowniaService` must **not** decide whether invoice creation is allowed.
- Issue/sell dates are set explicitly when custom invoice numbering is enabled (see below). Payment method is always `transfer` (przelew) with `payment_to_kind: off` (no due date) for all V1 invoice types — trigger is on paid Bitrix stage.
- API reference: [Fakturownia API](https://github.com/fakturownia/API) (`POST /invoices.json`).

### Environment (client)

| Variable | Required | Purpose |
|---|---|---|
| `FAKTUROWNIA_BASE_URL` | yes (except `NODE_ENV=test`) | Account base URL, e.g. `https://evapremium.fakturownia.pl` |
| `FAKTUROWNIA_API_TOKEN` | yes (except `NODE_ENV=test`) | API token sent as `api_token` in request body |
| `FAKTUROWNIA_REQUEST_TIMEOUT_MS` | no (default `30000`) | HTTP timeout per Fakturownia request |
| `FAKTUROWNIA_KSEF_STATUS_POLL_TIMEOUT_MS` | no (default `60000`) | Max wait while polling `gov_status` after create |
| `FAKTUROWNIA_KSEF_STATUS_POLL_INTERVAL_MS` | no (default `5000`) | Delay between KSeF status GET polls |
| `FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_MONTH` | no | When set (`YYYY-MM`), forces minimum next sequence per type in that month only |
| `FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FULL` | required if bootstrap month set | Next FULL (`vat`) sequence floor, e.g. `39` |
| `FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_ADVANCE` | required if bootstrap month set | Next ADVANCE sequence floor, e.g. `28` |
| `FAKTUROWNIA_INVOICE_NUMBER_BOOTSTRAP_FINAL` | required if bootstrap month set | Next FINAL sequence floor, e.g. `35` |

### Invoice numbering (V1)

Backend assigns explicit Fakturownia `number` before create. Fakturownia account auto-numbering must be disabled by operator.

Format: `{n}/{MM}/{YYYY}` — e.g. `39/05/2026`.

Rules:
- Separate sequence per `InvoiceType` (`FULL` → `vat`, `ADVANCE` → `advance`, `FINAL` → `final`).
- Sequence resets each calendar month (Europe/Warsaw): first invoice in a new month starts at `1/{MM}/{YYYY}` unless bootstrap month applies.
- Bootstrap month (ENV): `next = max(apiMaxInMonth + 1, envBootstrapNext)` for matching `YYYY-MM`.
- Non-bootstrap months: `next = max(apiMaxInMonth + 1, 1)`.
- `apiMaxInMonth` is read-only from Fakturownia `GET /invoices.json` filtered by `kind` and `issue_date` prefix `YYYY-MM`. Parser accepts legacy `{n}/{MM}.{YYYY}` and current `{n}/{MM}/{YYYY}` when reading existing invoices. For `ADVANCE` / `FINAL`, each additional prefixed invoice in the month adds one slot: `Z*` (advance) or `ZK*` (final) counts as `+1` on top of the highest numeric `{n}` in that month. New invoices are assigned `{n}/{MM}/{YYYY}`.
- Payload also sets `issue_date` and `sell_date` (ISO `YYYY-MM-DD`, Europe/Warsaw calendar day).

Implementation: `FakturowniaInvoiceNumberService.allocate()` → `FakturowniaMapper.toCreatePayload(..., numberAssignment)`.

### Create-invoice request (integration payload)

```ts
type FakturowniaCreateInvoiceRequest = {
  api_token: string; // from env; not part of InvoiceDraft mapping
  invoice: FakturowniaInvoicePayload;
};

type FakturowniaInvoicePayload = {
  kind: 'vat' | 'advance' | 'final';
  number: string;
  issue_date: string;
  sell_date: string;
  currency: 'PLN';
  buyer_name: string;
  buyer_tax_no: string;
  buyer_street: string;
  buyer_post_code: string;
  buyer_city: string;
  buyer_country: string;
  positions: FakturowniaPositionPayload[];
  advance_creation_mode?: 'amount';
  advance_value?: string;
  invoice_ids?: number[];
  payment_type: 'transfer';
  payment_to_kind: 'off';
};

type FakturowniaPositionPayload = {
  name: string;
  quantity: number;
  tax: number;
  total_price_gross: number;
};
```

Implementation: `src/modules/invoices/integrations/fakturownia/fakturownia.types.ts`.

### InvoiceDraft → Fakturownia payload mapping

Mapper: `FakturowniaMapper.toCreatePayload(invoiceDraft, numberAssignment, orderLinkage?)`.

| `InvoiceDraft.invoiceType` | Fakturownia `kind` | Additional invoice fields |
|---|---|---|
| `FULL` | `vat` | — |
| `ADVANCE` | `advance` | `advance_creation_mode: 'amount'`, `advance_value: String(advanceAmount)` |
| `FINAL` | `final` | `invoice_ids: [Number(previousAdvanceInvoiceId)]` |

All types also set `currency: 'PLN'`, `payment_type: 'transfer'`, `payment_to_kind: 'off'` (no payment due date on PDF), and shared buyer + positions (below).

**Buyer fields** (`InvoiceDraft.buyer` → invoice root):

| InvoiceDraft | Fakturownia payload |
|---|---|
| `buyer.companyName` | `buyer_name` |
| `buyer.nip` | `buyer_tax_no` |
| `buyer.street` | `buyer_street` |
| `buyer.postalCode` | `buyer_post_code` |
| `buyer.city` | `buyer_city` |
| `buyer.country` | `buyer_country` |

**Product positions** (`InvoiceDraft.products[]` → `positions[]`):

| InvoiceDraft `ProductLine` | Fakturownia `positions[]` |
|---|---|
| `name` | `name` |
| `quantity` | `quantity` |
| `vatRate` (always `23`) | `tax` |
| `totalGross` | `total_price_gross` |

Example shipping position (Evapremium V1, when `shippingCostField` > 0):

```json
{
  "name": "Wysyłka",
  "quantity": 1,
  "tax": 23,
  "total_price_gross": 19.99
}
```

**VAT, currency, unit (V1):**

| Rule | Mapping |
|---|---|
| Currency | Always `PLN` on invoice root (`InvoiceDraft.currency`) |
| VAT | Always `23` per position via `ProductLine.vatRate` → `tax` |
| Unit | V1 `ProductLine.unit` is always `'szt.'`; **not** sent in Fakturownia payload — provider default unit applies |

**ADVANCE / FINAL linkage (V1 target behavior):**

**Implemented now (invoice mapper + persistence):**

| Field | Source | Notes |
|---|---|---|
| `advance_value` | `InvoiceDraft.advanceAmount` | Set only for `ADVANCE`; validated before mapping |
| `invoice_ids` | `InvoiceDraft.previousAdvanceInvoiceId` | Set only for `FINAL`; value is **Fakturownia invoice ID** from prior successful `ADVANCE` `InvoiceRecord.fakturownia_invoice_id` (resolved in use case before validation) |

Order persistence: see **FakturowniaOrder persistence contract** below. One `fakturownia_orders` row per `bitrix_deal_id`; required before `ADVANCE`/`FINAL` invoice creation.

**Planned next (mapper + use case):**

| Field | Source | Notes |
|---|---|---|
| `copy_invoice_from` | `fakturownia_orders.fakturownia_order_id` for deal | Set only for `ADVANCE` and `FINAL`; requires persisted `FakturowniaOrder` row. Not yet wired in `FakturowniaMapper` or use case. |

V1 **`FULL`** invoices do not require a Fakturownia order. **`ADVANCE`** and **`FINAL`** require an existing `fakturownia_orders` row for the same `bitrix_deal_id` before invoice creation.

### FakturowniaOrder persistence contract

Repository: `FakturowniaOrderRepository`. Persistence types are **not** domain types.

```ts
type FakturowniaOrderRow = {
  id: string;
  bitrix_deal_id: string;
  fakturownia_order_id: string;
  fakturownia_order_number: string | null;
  created_from_invoice_process_id: string | null;
  created_at: string;
  updated_at: string;
};

type InsertFakturowniaOrderParams = {
  bitrix_deal_id: string;
  fakturownia_order_id: string;
  fakturownia_order_number?: string;
  created_from_invoice_process_id?: string;
};
```

Implementation: `src/modules/invoices/persistence/fakturownia-order.persistence.ts`.

Rules:
- **One order per deal:** `UNIQUE(bitrix_deal_id)` — shared by `ADVANCE` and `FINAL` for the same deal.
- **One row per provider order:** `UNIQUE(fakturownia_order_id)`.
- **`created_from_invoice_process_id`:** optional FK to `invoice_processes(id)`; records which process created the order when known.
- Order row must exist before `ADVANCE`/`FINAL` invoice creation; enforced in use case (follow-up task).

### Fakturownia create-order contract

Integration: `FakturowniaOrderMapper`, `FakturowniaOrderService`, `FakturowniaClient.createOrder`.

Rules:
- Input is only validated `InvoiceDraft` (same as invoice integration).
- `FakturowniaOrderService` must **not** decide whether order creation is allowed or persist to DB.
- Endpoint: `POST {FAKTUROWNIA_BASE_URL}/invoices.json` (same as invoices; Fakturownia uses `kind: estimate` for Zamówienie).
- Envelope: `{ api_token, invoice: FakturowniaOrderPayload }` — API key remains `invoice` per Fakturownia docs.

```ts
type FakturowniaCreateOrderRequest = {
  api_token: string;
  invoice: FakturowniaOrderPayload;
};

type FakturowniaOrderPayload = {
  kind: 'estimate';
  currency: 'PLN';
  oid: string;
  buyer_name: string;
  buyer_tax_no: string;
  buyer_street: string;
  buyer_post_code: string;
  buyer_city: string;
  buyer_country: string;
  positions: FakturowniaOrderPositionPayload[];
};

type FakturowniaOrderPositionPayload = {
  name: string;
  quantity: number;
  tax: number;
  total_price_gross: number;
};
```

Implementation: `src/modules/invoices/integrations/fakturownia/fakturownia.types.ts`.

**InvoiceDraft → order payload** (`FakturowniaOrderMapper.toCreatePayload`):

| Source | Target | Notes |
|---|---|---|
| — | `kind: 'estimate'` | always |
| `currency` | `currency: 'PLN'` | |
| `bitrixDealId` | `oid` | external deal reference |
| buyer fields | `buyer_*` | same mapping as invoice payload |
| `products[]` | `positions[]` | name, quantity, tax←vatRate, total_price_gross←totalGross |

**Not mapped:** `invoiceType`, `advanceAmount`, `previousAdvanceInvoiceId`, `unit`, `source`/`sourceId`.

**VAT, currency, unit (V1):** same rules as invoice payload — PLN, VAT 23 per position; unit `szt.` not sent.

**Raw create-order response:**

```ts
type FakturowniaOrderRaw = {
  id?: number | string;
  number?: string | null;
  oid?: string;
};
```

**Create-order result (integration):**

```ts
type FakturowniaCreateOrderResult = {
  fakturowniaOrderId: string;
  fakturowniaOrderNumber?: string;
};
```

Mapper: `FakturowniaOrderMapper.toCreateResult(raw)`.

| Raw field | Result field | Rule |
|---|---|---|
| `id` | `fakturowniaOrderId` | required; stringified |
| `number` | `fakturowniaOrderNumber` | optional; omitted if null/empty |

Maps to `InsertFakturowniaOrderParams` at persistence time (Task 9 use case). This integration layer does **not** write to `fakturownia_orders`.

**Integration errors:** same `FakturowniaErrorMapper` categories as invoice (`CLIENT` / `SERVER` / `TIMEOUT` / `UNKNOWN`).

**Not implemented in this integration task:** `copy_invoice_from` on invoice payload; use-case `ensureOrderForDeal`; DB persistence of order row.

### Raw create-invoice response (provider)

```ts
type FakturowniaInvoiceRaw = {
  id: number | string;
  view_url?: string;
  price_net?: number | string;
  price_gross?: number | string;
  currency?: string;
  gov_status?: string | null; // KSeF submission status from Fakturownia
};
```

### Create-invoice result (integration)

```ts
type FakturowniaCreateInvoiceResult = {
  fakturowniaInvoiceId: string;
  fakturowniaInvoiceNumber: string;
  fakturowniaInvoiceUrl: string;
  totalNet: number;
  totalGross: number;
  currency: 'PLN';
  ksefStatus?: 'SUBMISSION_CONFIRMED' | 'SUBMISSION_ERROR' | 'STATUS_UNKNOWN';
  ksefRawStatus?: string;
};
```

Mapper: `FakturowniaMapper.toCreateResult(raw)`.

| Fakturownia raw field | Result field | Rule |
|---|---|---|
| `id` | `fakturowniaInvoiceId` | stringified |
| — | `fakturowniaInvoiceNumber` | from `numberAssignment.number` at create (not from raw response) |
| `view_url` | `fakturowniaInvoiceUrl` | required on success; mapper error if missing |
| `price_net` | `totalNet` | parsed number; comma decimals supported |
| `price_gross` | `totalGross` | parsed number; comma decimals supported |
| — | `currency` | always `'PLN'` |
| `gov_status` | `ksefStatus`, `ksefRawStatus` | see KSeF table below; omitted when `gov_status` is `undefined` |

**KSeF status polling (V1):** After `POST /invoices.json`, when `gov_status` is `null`, `processing`, or `demo_processing`, `FakturowniaService` polls `GET /invoices/{id}.json?fields[invoice]=gov_status,gov_id` until a non-pending status or budget expiry. Env: `FAKTUROWNIA_KSEF_STATUS_POLL_TIMEOUT_MS` (default `60000`), `FAKTUROWNIA_KSEF_STATUS_POLL_INTERVAL_MS` (default `5000`). No re-send to KSeF; GET status only. Omitted `gov_status` (`undefined`) is not polled.

**KSeF status mapping** (`gov_status` → `ksefStatus`; V1 indirect KSeF via Fakturownia only):

| `gov_status` (raw) | `ksefStatus` |
|---|---|
| `ok`, `demo_ok` | `SUBMISSION_CONFIRMED` |
| `send_error`, `server_error`, `demo_send_error`, `demo_server_error`, `not_connected`, `demo_not_connected` | `SUBMISSION_ERROR` |
| `processing`, `demo_processing`, `null`, any other value | `STATUS_UNKNOWN` |

Reference: [Fakturownia KSeF API](https://github.com/fakturownia/API/blob/master/KSeF.md).

Process-level KSeF handling (`KSEF_SUBMISSION_CONFIRMED`, `KSEF_SUBMISSION_ERROR`, `KSEF_STATUS_UNKNOWN`) is owned by the invoice workflow use case (Task 9+), not the integration layer.

### Integration error categories

`FakturowniaErrorMapper` classifies provider failures at the integration boundary:

| Category | Condition | Use-case status (Task 9+) |
|---|---|---|
| `CLIENT` | HTTP 4xx | `FAKTUROWNIA_ERROR` |
| `SERVER` | HTTP 5xx | `FAKTUROWNIA_ERROR` |
| `TIMEOUT` | Request timeout / `AbortError` | `UNKNOWN_AFTER_TIMEOUT` |
| `UNKNOWN` | Other failures (network, config, unclassified HTTP) | `UNKNOWN_AFTER_TIMEOUT` |

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
    | 'DEAL_NOT_IN_PAID_STAGE'
    | 'MISSING_CUSTOMER_EMAIL'
    | 'INVALID_CUSTOMER_EMAIL';
  message: string;
  field?: string;
  source?: 'BITRIX_DEAL' | 'BITRIX_COMPANY' | 'PRODUCT_MAPPING' | 'INVOICE_RULE';
};
```
