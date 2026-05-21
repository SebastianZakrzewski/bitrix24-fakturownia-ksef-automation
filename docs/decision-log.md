# Decision Log V1

This file summarizes accepted/deferred decisions. Detailed context is distributed across the other docs.

## Accepted critical decisions
| Decision | Reason | V1 impact |
|---|---|---|
| DEEP mode | Financial/KSeF automation | Critical |
| Trigger: Bitrix24 paid stage -> n8n -> backend | Clear business trigger | High |
| Backend owns validation, idempotency, mapping and Fakturownia call | Critical logic must be testable | Critical |
| n8n only orchestrates trigger | No hidden financial logic | Critical |
| V1 supports `FULL`, `ADVANCE`, `FINAL` | Business requirement | Critical |
| Invoice type comes from Bitrix24 deal field | Explicit user/CRM decision | High |
| V1 client type is company with NIP | Simpler KSeF/business flow | High |
| Buyer data from `Deal -> Company` | Single CRM source | High |
| Missing NIP/company/address blocks invoice | Avoid invalid invoice | Critical |
| Product lines: main line fixed name + product rows detail | Evapremium: główna pozycja zawsze „Dywaniki Evapremium”; poboczne z `crm.deal.productrows` | High |
| `client_configs` Bitrix field mapping for Evapremium portal | Verified on deals 27000/27414; `PREPARATION`, UF codes, enum 718/720/722 | High |
| FINAL via UF typ faktury Dopełniająca (1328) + payment Pełna (718) + stage Oplacone | Operator workflow after advance invoice; field `UF_CRM_1776810914892` | High |
| `STALE` = stage mismatch only; incomplete FINAL UF (e.g. 1328+720) = validation, next trigger after fix | See `contracts.md` „Bitrix trigger timing vs FINAL” | High |
| One invalid product line blocks whole invoice | Avoid incorrect invoice amount | Critical |
| VAT fixed at 23% | V1 simplification | High |
| Fakturownia handles KSeF | Avoid direct KSeF integration V1 | Critical |
| Success requires Fakturownia invoice + KSeF submission confirmed + Bitrix comment with link | Complete business process | Critical |
| Invoice number is not stored in Bitrix24 | Business requirement | Medium |
| Invoice link is stored in comment and separate deal field | Operational convenience | High |
| Link field failure is warning-only | Comment link is minimum result | Medium |
| Idempotency key = `bitrix_deal_id + invoice_type` | Blocks duplicates but allows advance/final | Critical |
| `STALE_TRIGGER_IGNORED` is event only | Does not block future real process | Critical |
| `VALIDATION_FAILED` audit event uses same string as process status | Persisted in `invoice_events.event_type` when validation fails after process claim; not an `InvoiceProcessStatus` alias in code | Medium |
| `InvoiceRecord` existence blocks `createInvoice` permanently for process | Prevent duplicate invoice | Critical |
| No automatic retry for invoice creation | Prevent duplicate invoice | Critical |
| Timeout/unknown requires manual verification | Unknown if invoice was created | Critical |
| Simple client panel V1 | Basic visibility without scope creep | High |
| One panel admin account in V1 | Simple auth | Medium |
| Technical retry outside panel V1 | Recovery without UI complexity | High |
| No AI in V1 | Deterministic financial process | Critical |
| Security/observability/testing baselines accepted | Production safety | Critical |
| Fakturownia payload mapped from validated `InvoiceDraft` only | Keeps CRM validation separate from provider I/O | Critical |
| Fakturownia `FULL` → `kind: vat`; buyer + positions on invoice root | Standard VAT invoice via Fakturownia API | High |
| Fakturownia `ADVANCE` → `kind: advance` + `advance_creation_mode: amount` + `advance_value` | Advance amount from validated Bitrix field | High |
| Fakturownia `FINAL` → `kind: final` + `invoice_ids` from prior advance Fakturownia ID | Links final invoice to prior advance in provider | High |
| Fakturownia KSeF via `gov_status` → integration result only | No direct KSeF API in V1; workflow maps result in use case | High |
| V1 Fakturownia position mapping omits `unit`; provider default applies | `ProductLine.unit` is always `szt.`; not required in provider payload for V1 | Medium |
| `FAKTUROWNIA_*` env vars for client auth and timeout | Same pattern as Bitrix24 webhook config | Medium |
| `ADVANCE` and `FINAL` require Fakturownia order linkage | Fakturownia API expects advance/final from order via `copy_invoice_from`; one `fakturownia_orders` row per `bitrix_deal_id` | Critical |
| V1 uses `fakturownia_orders` + `copy_invoice_from` at invoice creation | Persisted order ID links ADVANCE/FINAL payloads to provider order | High |

## Open decisions

| ID | Decision needed | Status | Blocks |
|---|---|---|---|
| `OPEN_DECISION_FAKTUROWNIA_POSITION_UNIT` | Whether Fakturownia requires explicit position unit (`szt.`) on create-invoice | **Deferred** — V1 omits unit field; verify if invoices show wrong unit | Low; adjust mapper only if provider rejects or displays incorrect unit |
| `OPEN_DECISION_FAKTUROWNIA_CREATE_ORDER` | Fakturownia create-order API contract (endpoint, payload, workflow step before ADVANCE/FINAL) | **Not implemented** — persistence layer only | Task 9 happy path; order API client + use-case wiring |

Context for `OPEN_DECISION_FAKTUROWNIA_CREATE_ORDER`:
- `fakturownia_orders` table and `FakturowniaOrderRepository` are implemented.
- Order row must be created via Fakturownia order API before first `ADVANCE`/`FINAL` invoice for a deal.
- `copy_invoice_from` on invoice payload uses `fakturownia_orders.fakturownia_order_id`.
- **Owner:** Architect / Product Owner. **Verify before:** Task 9 production wiring or first Evapremium account test.

## Deferred decisions / V2+
| Feature | Target |
|---|---|
| Client panel manual retry | V2 |
| Panel roles and multiple users | V2 |
| Detailed process/audit in panel | V2 |
| Invoice corrections | V2 |
| Bitrix24 login/OAuth | V2 |
| All Fakturownia invoices in panel | V2/V3 |
| Multiple advance invoices per deal | V2/V3 |
| Direct KSeF integration | V3_OR_LATER |
| Multi-tenant SaaS | V3_OR_LATER |

## Not needed now
| Feature | Reason |
|---|---|
| Manual invoice creation from panel | Risk and scope creep |
| Automatic deletion/cancellation of invoices | High accounting risk |
| AI as financial decision-maker | Non-deterministic and not needed |
