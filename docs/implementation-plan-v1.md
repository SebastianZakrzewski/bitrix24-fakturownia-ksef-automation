# Implementation Plan V1 for Cursor

## Scope principle
Implement V1 only. Do not build V2 features such as client panel, panel retry, roles, corrections, all-Fakturownia invoice sync, multi-tenant SaaS or direct KSeF integration.

## Suggested task order

### Task 1 — Project structure and base modules
Create NestJS module structure:
- `invoices`
- `bitrix24`
- `client-panel` (skeleton only — V2 feature)
- `health`

Add folders according to `/docs/modules-reliability.md`.

Validation:
- app builds,
- modules compile,
- no business logic yet.

### Task 2 — Domain/application types and enums
Implement:
- `InvoiceType`
- `InvoiceProcessStatus`
- `ProductLine`
- `ValidationError`
- `InvoiceDraft`
- `InvoiceEvent` type
- DTO/Command types

Validation:
- type-check passes,
- no `any`,
- statuses match docs exactly.

### Task 3 — Database migrations
Create DB schema:
- `invoice_processes`
- `invoice_records`
- `invoice_events`
- `bitrix_deal_snapshots`
- `client_configs`
- `technical_retry_attempts`
- `panel_admin_users`

Include constraints from `/docs/database-schema.md`.

Validation:
- migrations run,
- unique constraints tested,
- nullable `invoice_events.invoice_process_id` works.

### Task 4 — Repositories
Implement repositories:
- `InvoiceProcessRepository`
- `InvoiceRecordRepository`
- `InvoiceEventRepository`
- `BitrixDealSnapshotRepository`
- `ClientConfigRepository`
- `TechnicalRetryAttemptRepository`

Rules:
- no business logic in repositories,
- repositories only persist/read.

Validation:
- integration tests with test DB.

### Task 5 — Bitrix24 module contract and mockable services
Implement Bitrix24 module services and types:
- `Bitrix24Client`
- `Bitrix24DealService`
- `Bitrix24CompanyService`
- `Bitrix24ProductRowService`
- `Bitrix24TimelineService`
- `Bitrix24DealFieldService`
- `Bitrix24Mapper`

Validation:
- mock external API in tests,
- no invoice logic in Bitrix24 module.

### Task 6 — Invoice mapping and validation
Implement:
- `BitrixInvoiceMapper`
- `InvoiceValidationService`
- `InvoiceDraftBuilderService`
- `InvoiceCommentService`

Rules:
- map main product from deal fields and product rows into `ProductLine[]`,
- VAT fixed at 23,
- one invalid product line blocks whole invoice,
- no Fakturownia call before validation.

Validation:
- unit tests for missing invoice type/company/NIP/products/invalid product/advance/final rules.

### Task 7 — Idempotency and lifecycle services
Implement:
- `InvoiceProcessService`
- `InvoiceIdempotencyService`
- `claimInvoiceProcess`
- allowed lifecycle transitions.

Rules:
- parallel duplicate request reads existing process after DB conflict,
- `STALE_TRIGGER_IGNORED` event does not create process,
- existing `InvoiceRecord` blocks `createInvoice`.

Validation:
- integration test for race/constraint,
- unit tests for lifecycle transitions.

### Task 8 — Fakturownia integration
Implement inside `modules/invoices/integrations/fakturownia`:
- `FakturowniaClient`
- `FakturowniaService`
- `FakturowniaMapper`
- `FakturowniaErrorMapper`
- integration types.

Rules:
- input is only validated `InvoiceDraft`,
- map raw response to `FakturowniaCreateInvoiceResult`,
- distinguish 4xx/5xx/timeout/unknown.

Validation:
- mocked tests for success, error, timeout, KSeF confirmed/error/unknown.

### Task 9 — Main use case
Implement `CreateInvoiceFromBitrixDealUseCase` according to `/docs/modules-reliability.md`.

Validation:
- happy path FULL/ADVANCE/FINAL,
- validation failures,
- stale trigger,
- Fakturownia timeout/error,
- KSeF unknown,
- Bitrix comment failure,
- Bitrix link field warning,
- customer email failure,
- duplicate email idempotency.

### Task 10 — API endpoints
Implement:
- `POST /invoice-processes/bitrix-trigger`
- `POST /admin/invoice-processes/:id/retry`
- `POST /admin/invoice-processes/:id/mark-reviewed`
- `GET /health`

Optional skeleton only (V2): `GET /client/invoice-processes`

Rules:
- trigger endpoint protected by API key,
- admin endpoints protected by admin secret,
- response DTOs match docs.

Validation:
- API tests for auth and DTO responses.

### Task 11 — Customer invoice email delivery
Implement invoice email orchestration and provider integration skeleton:
- `InvoiceEmailService` in invoices module
- `modules/invoices/integrations/email` provider client/service/mapper/types
- wire into `CreateInvoiceFromBitrixDealUseCase` after Bitrix comment success
- load customer email from validated `InvoiceDraft.buyer.customerEmail` (populated at validation from deal contact per `/docs/contracts.md`)
- send Fakturownia invoice link and/or PDF attachment
- audit every send attempt
- `RETRY_INVOICE_EMAIL` in `TechnicalRetryService`

Rules:
- no email before validation and confirmed Fakturownia invoice,
- no duplicate email for same process,
- email failure does not cancel Fakturownia invoice,
- `COMPLETED` only after successful email delivery.

Validation:
- mocked provider tests for success, 4xx, 5xx, timeout,
- forbidden side effect tests (no email before validation/invoice),
- happy path includes email step,
- no full email addresses in logs.

### Task 12 — Technical retry
Implement `TechnicalRetryService` and admin endpoints.

Rules:
- every attempt recorded,
- `UNKNOWN_AFTER_TIMEOUT` blocks create retry until manual review,
- existing `InvoiceRecord` blocks create retry,
- Bitrix sync retry only syncs Bitrix.

Validation:
- allowed and blocked retry tests,
- forbidden side effects tests.

### Task 13 — Security/observability
Implement:
- structured logs,
- request/correlation ID,
- redaction rules,
- rate limiting for trigger,
- health check.

Optional V2 follow-up: panel login, CORS, panel list endpoint.

Validation:
- no sensitive data in logs,
- unauthorized endpoint tests.

### Task 14 — Final V1 test pass
Run:
- type-check,
- lint,
- unit tests,
- integration tests,
- API tests,
- build.

Task is incomplete if business scenarios or forbidden side effects are not covered.

## V1 done definition
V1 is done only when:
- core invoice flow works for `FULL`, `ADVANCE`, `FINAL`,
- duplicates are blocked,
- validation blocks bad invoices,
- Fakturownia/KSeF/Bitrix/email errors produce correct statuses,
- audit exists,
- customer invoice email delivery works,
- technical retry is controlled,
- no V2/V3 scope is implemented accidentally,
- all checks pass.
