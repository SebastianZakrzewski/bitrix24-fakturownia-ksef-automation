# Modules and Reliability V1

## Module structure
```text
src/
  modules/
    invoices/
      controllers/
      dto/
      use-cases/
      services/
      repositories/
      mappers/
      types/
      integrations/
        fakturownia/
    bitrix24/
      client/
      services/
      dto/
      types/
      mappers/
    client-panel/
      controllers/
      dto/
      services/
      repositories/
    health/
```

## invoices module
Main module for invoice automation process.

### Use case
`CreateInvoiceFromBitrixDealUseCase`

Responsibilities:
1. Accept `CreateInvoiceFromBitrixDealCommand`.
2. Load active `ClientConfig`.
3. Load current deal from Bitrix24 module.
4. Verify current paid stage.
5. Record `STALE_TRIGGER_IGNORED` event without process if stale.
6. Extract/map invoice type.
7. Atomically claim process by `bitrixDealId + invoiceType`.
8. Load company and product rows.
9. Save Bitrix snapshot.
10. Map buyer/products.
11. Validate invoice rules.
12. On validation errors set `VALIDATION_FAILED`, save event, comment Bitrix24.
13. Build `InvoiceDraft`.
14. Set `INVOICE_CREATION_IN_PROGRESS`.
15. Call Fakturownia integration.
16. Save `InvoiceRecord` and statuses.
17. Add Bitrix timeline comment with link.
18. Try to update Bitrix link field.
19. Set `COMPLETED` or error status.

### Services
| Service | Responsibility |
|---|---|
| `InvoiceProcessService` | Lifecycle transitions and finalization |
| `InvoiceValidationService` | Invoice type, buyer, products, advance/final rules |
| `InvoiceDraftBuilderService` | Build `InvoiceDraft` |
| `InvoiceIdempotencyService` | Claim/find process for `dealId + invoiceType` |
| `InvoiceCommentService` | Build deterministic Bitrix comments |
| `TechnicalRetryService` | Evaluate and execute allowed technical retries |

### Mappers
| Mapper | Responsibility |
|---|---|
| `BitrixInvoiceMapper` | Map Bitrix24 data + config to invoice models |
| `FakturowniaMapper` | Map `InvoiceDraft` to Fakturownia payload and raw response to result |

### Repositories
| Repository | Responsibility |
|---|---|
| `InvoiceProcessRepository` | CRUD, find by deal/type, update status |
| `InvoiceRecordRepository` | Store/read created invoices |
| `InvoiceEventRepository` | Store audit events, including events without process id |
| `BitrixDealSnapshotRepository` | Store Bitrix snapshots |
| `FakturowniaOrderRepository` | Store/read Fakturownia orders per `bitrix_deal_id` (one row per deal) |
| `ClientConfigRepository` | Load active config |
| `TechnicalRetryAttemptRepository` | Store retry attempts |

## bitrix24 module
Separate module because Bitrix24 is a shared CRM integration for future SellGenius processes.

| Element | Responsibility |
|---|---|
| `Bitrix24Client` | HTTP/API, auth, base URL, request handling |
| `Bitrix24DealService` | Load deal and custom fields |
| `Bitrix24CompanyService` | Load linked company |
| `Bitrix24ProductRowService` | Load product rows |
| `Bitrix24TimelineService` | Add timeline comments |
| `Bitrix24DealFieldService` | Update invoice link field |
| `Bitrix24Mapper` | Raw response to `BitrixDealData`, `BitrixCompanyData`, `BitrixProductRow` |

The Bitrix24 module must not know invoice business rules.

## Fakturownia integration
Located in `modules/invoices/integrations/fakturownia`.

| Element | Responsibility |
|---|---|
| `FakturowniaClient` | Low-level HTTP/API, auth, timeouts, errors |
| `FakturowniaService` | `createInvoice(invoiceDraft)` returns `FakturowniaCreateInvoiceResult` |
| `FakturowniaMapper` | `InvoiceDraft -> API payload`, raw response -> result |
| `FakturowniaTypes` | Payload/result/raw response types |
| `FakturowniaErrorMapper` | Map 4xx/5xx/timeout/unknown to controlled errors |

Fakturownia integration must not decide whether an invoice is allowed.

## Reliability rules
### Idempotency and race condition
| Situation | Behavior |
|---|---|
| Two parallel webhooks same `deal_id + invoice_type` | First creates process, second catches DB conflict and reads existing process |
| Existing `COMPLETED` process | No invoice creation; return existing result |
| Existing `INVOICE_CREATION_IN_PROGRESS` | No second process and no retry |
| `VALIDATION_FAILED` | Requires technical retry after data correction |
| `UNKNOWN_AFTER_TIMEOUT` | Blocks invoice creation retry until manual review |
| `InvoiceRecord` exists | Permanent block for another `createInvoice` call |
| `STALE_TRIGGER_IGNORED` | Event only, no process, no future block |

### Asynchronous workflow control
The process is controlled by DB state, not by assuming a linear synchronous request.

Rules:
- Always persist before and after critical side effects.
- Set `INVOICE_CREATION_IN_PROGRESS` before Fakturownia call.
- Save `InvoiceRecord` immediately after confirmed Fakturownia success.
- Timeout becomes `UNKNOWN_AFTER_TIMEOUT`.
- KSeF unknown becomes `KSEF_STATUS_UNKNOWN`.
- Bitrix sync failure after invoice creation allows only Bitrix sync retry.

### Error handling
| Area | Rule |
|---|---|
| Fakturownia 4xx/5xx | `FAKTUROWNIA_ERROR`, no auto retry |
| Fakturownia timeout | `UNKNOWN_AFTER_TIMEOUT`, manual review |
| KSeF unknown/error | No new invoice, manual handling |
| Cannot load Bitrix deal | Event only, no process |
| Deal not paid anymore | `STALE_TRIGGER_IGNORED` event only |
| Missing company/products after deal load | `VALIDATION_FAILED` |
| Bitrix comment failure after invoice/KSeF | `MANUAL_REVIEW_REQUIRED`, retry only Bitrix sync |
| Bitrix link field failure | Warning event only, `COMPLETED` allowed |
