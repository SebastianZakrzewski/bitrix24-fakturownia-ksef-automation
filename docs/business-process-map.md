# Business Process Map V1

## Actors
| Actor/System | Responsibility |
|---|---|
| Sales/CRM user | Moves deal to `Opłacone` and maintains correct deal/company/product data |
| Bitrix24 | Source of deal, company, product rows, invoice type, advance amount and paid stage |
| n8n | Receives Bitrix24 trigger and forwards minimal payload to backend |
| Backend NestJS | Validates, maps, creates process, controls idempotency, calls Fakturownia, syncs Bitrix24 |
| Fakturownia | Creates invoice and handles KSeF submission automatically |
| KSeF | Indirectly handled by Fakturownia in V1 |
| Client panel | Shows list of invoice processes/factors created by this system |
| Operator/Admin | Can use technical retry outside the client panel |

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
Product data comes from two places:

1. Main/parent product from Bitrix24 custom deal fields.
2. Subordinate/additional products from Bitrix24 product rows.

Both sources are mapped into unified `ProductLine[]`.

Rules:
- Main product can be missing/invalid if there are valid product rows.
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
| Comment with invoice link added | Required for `COMPLETED` |
| Link field update failed | Warning-only; process can be `COMPLETED` |
| Comment failed after invoice/KSeF success | `MANUAL_REVIEW_REQUIRED`, retry only Bitrix sync |

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
