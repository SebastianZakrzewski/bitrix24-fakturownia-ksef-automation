# Security, Observability and Testing V1

## AI decision
No AI/LLM in V1 invoice process.

Reasons:
- Invoice/KSeF flow requires deterministic, testable rules.
- AI must not decide invoice type, validation, mapping, retry or status transitions.
- Bitrix24 comments use deterministic templates.

AI may be considered in V2/V3 for explanations, diagnostics or helper text, not as financial decision-maker.

## Security baseline
| Area | Rule |
|---|---|
| API secrets | `.env` / secrets manager only, never DB/logs |
| Bitrix24/Fakturownia tokens | Never log full values |
| Company/NIP/address data | Do not log in ordinary text logs |
| Bitrix snapshots | Store in DB, do not print raw payloads to logs |
| Client panel password | Store as `password_hash`, never plaintext |
| n8n -> backend endpoint | Protected by secret/API key |
| Admin retry endpoints | Protected by separate admin secret/API key |
| Public access | Only panel login and health are public-facing |
| CORS | Restricted to panel domain |
| Rate limiting | Minimum on login and trigger endpoint |
| Audit | Every invoice and retry operation stored in DB |

## Observability baseline
| Area | Rule |
|---|---|
| Structured logs | JSON logs with `process_id`, `bitrix_deal_id`, `status`, `event_type` |
| Sensitive data | No NIP, address, tokens, full payloads in logs |
| Invoice events | Main audit trail in `invoice_events` |
| Error logs | Technical errors with code and context ID |
| Healthcheck | `GET /health` |
| Request ID | Every request has request/correlation ID |
| n8n monitoring | n8n logs backend result only, not invoice data |
| Fakturownia errors | Distinguish 4xx/5xx/timeout/unknown |
| Bitrix errors | Distinguish deal/company/product/comment/field update failures |
| Alerts | At minimum for `UNKNOWN_AFTER_TIMEOUT`, `FAKTUROWNIA_ERROR`, `KSEF_STATUS_UNKNOWN`, `MANUAL_REVIEW_REQUIRED` |

## Testing baseline
| Type | Scope |
|---|---|
| Unit tests | Validation, mappers, lifecycle, idempotency, retry rules |
| Integration tests | Repositories, DB constraints, `claimInvoiceProcess`, event writes |
| API tests | Trigger endpoint, panel list endpoint, retry endpoint, mark-reviewed endpoint |
| Mocked external tests | Bitrix24 service mock, Fakturownia service mock |
| Business behavior tests | Stage 6 accepted scenarios |
| Forbidden side effects tests | No Fakturownia before validation, no repeated `createInvoice`, no retry after unknown |
| Security tests basic | No public trigger/admin endpoints without secret |
| Build checks | Type-check, lint, tests before deploy |

## Required business tests
| Area | Test |
|---|---|
| Happy path `FULL` | Paid deal + valid data -> FULL invoice -> KSeF confirmed -> Bitrix comment -> `COMPLETED` |
| Happy path `ADVANCE` | Valid advance amount -> advance invoice -> `COMPLETED` |
| Happy path `FINAL` | Previous successful `ADVANCE` exists -> final invoice -> `COMPLETED` |
| Missing invoice type | `VALIDATION_FAILED`, no Fakturownia call |
| Missing company | `VALIDATION_FAILED`, no Fakturownia call |
| Missing NIP | `VALIDATION_FAILED`, no Fakturownia call |
| Missing products | `VALIDATION_FAILED`, no Fakturownia call |
| Invalid product line | Whole invoice blocked |
| Duplicate webhook | Second invoice not created |
| Parallel webhooks | DB constraint/`claimInvoiceProcess` blocks second process |
| Stale webhook | `STALE_TRIGGER_IGNORED` event, no `InvoiceProcess` |
| Fakturownia timeout | `UNKNOWN_AFTER_TIMEOUT`, no auto retry |
| Fakturownia error | `FAKTUROWNIA_ERROR`, no auto retry |
| Existing invoice | Retry does not call Fakturownia again |
| KSeF status unknown | `KSEF_STATUS_UNKNOWN`, no new invoice |
| Bitrix comment failure | `MANUAL_REVIEW_REQUIRED`, retry only Bitrix sync |
| Bitrix link field failure | `COMPLETED`, warning in audit |

## Test completion rule
A task is incomplete if:
- tests only happy path,
- side effects happen before validation,
- duplicate invoice path is not tested,
- timeout/unknown behavior is not tested,
- status lifecycle changes without updated tests,
- forbidden side effects are not asserted.
