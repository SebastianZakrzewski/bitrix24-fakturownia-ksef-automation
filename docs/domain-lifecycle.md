# Domain and Lifecycle V1

## Core entities
| Entity | Responsibility |
|---|---|
| `InvoiceProcess` | Main lifecycle object for one deal and invoice type |
| `InvoiceRecord` | Invoice actually created in Fakturownia by this system |
| `InvoiceEvent` | Audit trail of process and trigger events |
| `BitrixDealSnapshot` | Auditable snapshot of Bitrix data loaded for a real process |
| `ClientConfig` | Field mappings and client configuration |
| `TechnicalRetryAttempt` | Audit record for technical retry attempt |
| `PanelAdminUser` | Client admin account for V2 panel (table may exist from early setup; not MVP_REQUIRED in V1) |

## InvoiceType
```ts
type InvoiceType = 'FULL' | 'ADVANCE' | 'FINAL';
```

| Value | Meaning |
|---|---|
| `FULL` | Full invoice without advance |
| `ADVANCE` | Advance invoice |
| `FINAL` | Final/completion invoice after previous advance |

## InvoiceProcessStatus
```ts
type InvoiceProcessStatus =
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
  | 'COMPLETED';
```

`STALE_TRIGGER_IGNORED` is not an `InvoiceProcessStatus`. It is an `InvoiceEvent.type` because stale triggers do not create real invoice processes.

## Lifecycle transitions
| From | To |
|---|---|
| `TRIGGER_RECEIVED` | `VALIDATION_FAILED` |
| `TRIGGER_RECEIVED` | `INVOICE_CREATION_IN_PROGRESS` |
| `VALIDATION_FAILED` | `TRIGGER_RECEIVED` through technical retry after data correction |
| `INVOICE_CREATION_IN_PROGRESS` | `FAKTUROWNIA_ERROR` |
| `INVOICE_CREATION_IN_PROGRESS` | `UNKNOWN_AFTER_TIMEOUT` |
| `INVOICE_CREATION_IN_PROGRESS` | `INVOICE_CREATED` |
| `FAKTUROWNIA_ERROR` | `INVOICE_CREATION_IN_PROGRESS` through technical retry only if confirmed invoice was not created |
| `UNKNOWN_AFTER_TIMEOUT` | `MANUAL_REVIEW_REQUIRED` |
| `MANUAL_REVIEW_REQUIRED` | `INVOICE_CREATION_IN_PROGRESS` only after manual confirmation that invoice was not created |
| `INVOICE_CREATED` | `KSEF_SUBMISSION_CONFIRMED` |
| `INVOICE_CREATED` | `KSEF_SUBMISSION_ERROR` |
| `INVOICE_CREATED` | `KSEF_STATUS_UNKNOWN` |
| `KSEF_SUBMISSION_CONFIRMED` | Bitrix24 timeline comment with link, then customer invoice email, then `COMPLETED` |
| `KSEF_SUBMISSION_ERROR` | `MANUAL_REVIEW_REQUIRED` |
| `KSEF_STATUS_UNKNOWN` | `MANUAL_REVIEW_REQUIRED` |
| After Bitrix comment + email success | `COMPLETED` |
| Email failure after invoice/KSeF/Bitrix comment | `MANUAL_REVIEW_REQUIRED`; retry only invoice email |
| `COMPLETED` | Terminal in V1 |

## Idempotency
```text
idempotency_key = bitrix_deal_id + ':' + invoice_type
```

DB constraint:
```sql
unique(bitrix_deal_id, invoice_type)
unique(idempotency_key)
```

Rules:
- Same deal + same invoice type -> one real process only.
- Same deal + different invoice type -> allowed, e.g. `ADVANCE` then `FINAL`.
- `STALE_TRIGGER_IGNORED` does not create `InvoiceProcess` and does not block future real process.

## ProductLine
```ts
type ProductLine = {
  source: 'DEAL_FIELDS' | 'DEAL_PRODUCT_ROW';
  sourceId?: string;
  name: string;
  quantity: number;
  unit: 'szt.';
  unitGrossPrice: number;
  totalGross: number;
  vatRate: 23;
};
```

Validation:
- Empty `name` -> block invoice.
- `quantity <= 0` -> block invoice.
- `unitGrossPrice < 0` -> block invoice.
- `totalGross < 0` -> block invoice.
- Zero `unitGrossPrice` / `totalGross` on a line is allowed (gratis lines).
- For `FULL` and `FINAL`, sum of `products[].totalGross` must be `> 0`.
- One invalid line blocks whole invoice.

## InvoiceDraft
```ts
type InvoiceDraft = {
  bitrixDealId: string;
  invoiceType: InvoiceType;
  buyer: {
    companyName: string;
    nip: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  products: ProductLine[];
  advanceAmount?: number;
  previousAdvanceInvoiceId?: string;
  currency: 'PLN';
  vatRate: 23;
};
```

`buyer.country` may be an empty string when Bitrix company has no country; street, postal code and city remain required.

`InvoiceDraft` is an internal validated model. Fakturownia receives only a payload mapped from this draft, not raw Bitrix data.
