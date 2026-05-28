# Business Process Map V1

## Actors
| Actor/System | Responsibility |
|---|---|
| Sales/CRM user | Moves deal to `Opłacone` and maintains correct deal/company/product data |
| Bitrix24 | Source of deal, company, product rows, invoice type, advance amount and paid stage |
| n8n | Receives Bitrix24 trigger and forwards minimal payload to backend |
| Backend NestJS | Validates, maps, creates process, controls idempotency, calls Fakturownia, syncs Bitrix24, orchestrates customer invoice email |
| Fakturownia | Creates invoice and handles KSeF submission automatically; provides invoice PDF/link for email |
| KSeF | Indirectly handled by Fakturownia in V1 |
| Email provider | Outbound integration used by backend to deliver invoice email to customer |
| Operator/Admin | Can use technical retry outside any client UI (V2) |

## Trigger
Given a Bitrix24 deal changes to paid stage `Opłacone`, when Bitrix24 automation rule/webhook runs, then n8n forwards the minimal payload to the backend.

## Required start conditions
- Deal has invoice type.
- Deal has linked `Company`.
- `Company` has NIP, name, street, postal code, city, country.
- Deal can produce a non-empty valid `products[]` list.
- Invoice type-specific conditions are satisfied.

## Invoice types
| Type | Meaning | V1 rule |
|---|---|---|
| `FULL` | Full invoice | Uses products and buyer data |
| `ADVANCE` | Advance invoice | Requires valid advance amount from Bitrix24 deal field |
| `FINAL` | Final/completion invoice | Requires previous successful `ADVANCE` invoice record created by this system for the same deal |

## Product mapping
Product data comes from three places:

1. Main/parent product from Bitrix24 custom deal fields (`OPPORTUNITY` minus other lines).
2. Subordinate/additional products from Bitrix24 product rows.
3. Shipping cost from Bitrix24 deal custom field (`shippingCostField` → separate „Wysyłka” line when > 0).

All lines are mapped into unified `ProductLine[]`.

Rules:
- Main product can be missing/invalid if there are valid product rows.
- Shipping line is optional; omitted when cost is zero or missing.
- Empty final `products[]` blocks invoice creation.
- One invalid product line blocks the whole invoice.
- The system never silently drops invalid lines and invoices only the remaining products.

## Validation failures
Given a trigger is valid but data is incomplete, when backend validates the process, then:

- No invoice is created.
- Status becomes `VALIDATION_FAILED`.
- Validation errors are stored in DB.
- A Bitrix24 timeline comment is added if possible.
- No automatic retry occurs.

## Fakturownia errors
| Situation | Behavior |
|---|---|
| Known 4xx/validation/auth error | `FAKTUROWNIA_ERROR`, event, Bitrix24 comment |
| 5xx | `FAKTUROWNIA_ERROR`, no automatic retry |
| Timeout/unknown result | `UNKNOWN_AFTER_TIMEOUT`, manual verification required |
| Invoice may have been created | No retry until manual review confirms safe action |

## KSeF via Fakturownia
V1 does not integrate directly with KSeF. Fakturownia handles KSeF submission. V1 success requires Fakturownia to confirm KSeF submission status, not full UPO/reference completion.

## Bitrix24 sync results
| Situation | Behavior |
|---|---|
| Comment with invoice link added | Required before customer email and `COMPLETED` |
| Link field update failed | Warning-only; process can be `COMPLETED` after email sent |
| Comment failed after invoice/KSeF success | `MANUAL_REVIEW_REQUIRED`, retry only Bitrix sync |

## Customer invoice email delivery
Given invoice creation and KSeF submission are confirmed (or manual review cleared KSeF unknown/error per operator workflow), and Bitrix24 timeline comment with invoice link was added, when backend sends the customer-facing invoice email, then:

- Email includes Fakturownia invoice link and/or PDF attachment from Fakturownia.
- Recipient address comes from Bitrix24 (field/source defined in `/docs/contracts.md`; see `OPEN_DECISION_CUSTOMER_EMAIL_SOURCE` until confirmed).
- Send attempt is audited in DB (`invoice_events` and/or dedicated email audit fields when implemented).
- `COMPLETED` is set only after successful email delivery.

| Situation | Behavior |
|---|---|
| Customer email missing/invalid at validation | `VALIDATION_FAILED`, no Fakturownia call |
| Email provider success | Audit event recorded; process can reach `COMPLETED` if Bitrix comment succeeded |
| Email provider 4xx/validation error | `MANUAL_REVIEW_REQUIRED`, retry only invoice email |
| Email provider 5xx/timeout/unknown | `MANUAL_REVIEW_REQUIRED`, no automatic retry; manual verification required |
| Email failed after invoice/KSeF/Bitrix comment success | `MANUAL_REVIEW_REQUIRED`, retry only invoice email; invoice remains in Fakturownia |
| Duplicate trigger/retry after email already sent | Idempotency must not send duplicate customer email for same process |

## Forbidden outcomes
| Code | Meaning |
|---|---|
| `NO_DUPLICATE_INVOICE` | No second invoice of same type for same deal |
| `NO_INVOICE_WITHOUT_VALIDATION` | No Fakturownia call before full validation |
| `NO_INVOICE_WITH_EMPTY_PRODUCTS` | No invoice without product lines |
| `NO_INVOICE_WITH_INVALID_PRODUCT` | No partial invoice after dropping invalid line |
| `NO_INVOICE_WITHOUT_COMPANY` | No company -> no invoice |
| `NO_INVOICE_WITHOUT_NIP` | No NIP -> no company invoice |
| `NO_KSEF_BEFORE_FAKTUROWNIA_CONFIRMATION` | KSeF status only after invoice creation confirmation |
| `NO_RETRY_AFTER_UNKNOWN_WITHOUT_MANUAL_REVIEW` | Timeout/unknown blocks unsafe retry |
| `NO_CRITICAL_LOGIC_IN_N8N` | n8n only orchestrates trigger |
| `NO_COMPLETED_WITHOUT_BITRIX_COMMENT` | Comment with link required for `COMPLETED` |
| `NO_COMPLETED_WITHOUT_CUSTOMER_EMAIL` | Customer invoice email required for `COMPLETED` |
| `NO_EMAIL_BEFORE_VALIDATED_INVOICE` | No customer email before validation, idempotency check, and confirmed Fakturownia invoice |
| `NO_DUPLICATE_CUSTOMER_EMAIL` | No second customer email for same completed process |
| `NO_AUTO_DELETE_OR_CANCEL_INVOICE` | No automatic invoice deletion/cancellation in V1 |

## Given/When/Then validation scenarios
| Rule | Validation |
|---|---|
| Missing invoice type | Given paid deal without invoice type, when validated, then no invoice and `VALIDATION_FAILED` |
| Missing company | Given deal has no `Company`, when process starts, then no invoice |
| Missing NIP | Given `Company` lacks NIP, when buyer validation runs, then no invoice |
| Missing products | Given no valid `ProductLine`, when mapping finishes, then no invoice |
| Invalid product line | Given one line has missing price/quantity/name, when validating products, then whole invoice is blocked |
| Duplicate | Given successful same type invoice exists for deal, when trigger repeats, then no second invoice |
| Fakturownia timeout | Given timeout after create request, then `UNKNOWN_AFTER_TIMEOUT` and manual verification required |
| KSeF error/unknown | Given invoice exists but KSeF is error/unknown, then invoice remains and manual review is required |
| Bitrix comment failure | Given invoice/KSeF OK but Bitrix comment fails, then no `COMPLETED`; retry only Bitrix sync |
| Missing customer email | Given paid deal without valid customer email from Bitrix24, when validated, then no invoice and `VALIDATION_FAILED` |
| Customer email failure | Given invoice/KSeF/Bitrix comment OK but email fails, then no `COMPLETED`; retry only invoice email |
| Duplicate email retry | Given email already sent for process, when retry runs, then no second email |
