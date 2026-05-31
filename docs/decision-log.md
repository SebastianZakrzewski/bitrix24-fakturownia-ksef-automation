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
| Buyer `country` optional; street/postal/city required | Evapremium CRM may omit country | Medium |
| Product lines may be `0` PLN; FULL/FINAL total gross must be `> 0` | Gratis add-ons allowed | High |
| Product lines: main line fixed name + product rows detail | Evapremium: główna pozycja zawsze „Dywaniki Evapremium”; poboczne z `crm.deal.productrows` | High |
| Shipping cost as separate `ProductLine` („Wysyłka”) | Bitrix UF `UF_CRM_1764865232643` (Dostawa); excluded from main line; Fakturownia has no top-level shipping field — sent in `positions[]` | High |
| `client_configs` Bitrix field mapping for Evapremium portal | Verified on deals 27000/27414; `PREPARATION`, UF codes, enum 718/720/722 | High |
| Evapremium buyer address from `crm.address.list` when `companyAddressSource=CRM_ADDRESS_LIST` | Company/requisite columns often empty; address.list holds legal address (deal 18690) | High |
| FINAL via UF typ faktury Dopełniająca (1328) + payment Pełna (718) + stage Oplacone | Operator workflow after advance invoice; field `UF_CRM_1776810914892` | High |
| `STALE` = stage mismatch only; incomplete FINAL UF (e.g. 1328+720) = validation, next trigger after fix | See `contracts.md` „Bitrix trigger timing vs FINAL” | High |
| One invalid product line blocks whole invoice | Avoid incorrect invoice amount | Critical |
| VAT fixed at 23% | V1 simplification | High |
| Fakturownia handles KSeF | Avoid direct KSeF integration V1 | Critical |
| Success requires Fakturownia invoice + KSeF submission confirmed + Bitrix comment with link + customer invoice email | Complete business process | Critical |
| Invoice number is not stored in Bitrix24 | Business requirement | Medium |
| Invoice link is stored in comment and separate deal field | Operational convenience | High |
| Link field failure is warning-only | Comment link and email are minimum result | Medium |
| V1 defers simple client panel to V2 | Customer delivery via email replaces panel visibility for MVP | High |
| V1 sends customer invoice by email with Fakturownia PDF and/or link | Customer-facing delivery without panel | Critical |
| Customer email required before Fakturownia side effects | Avoid invoice without delivery path | High |
| One customer email per process; no duplicate on retry | Idempotency for outbound side effect | Critical |
| Email failure after invoice creation -> `MANUAL_REVIEW_REQUIRED`, retry only email | Same recovery pattern as Bitrix sync | High |
| Idempotency key = `bitrix_deal_id + invoice_type` | Blocks duplicates but allows advance/final | Critical |
| `STALE_TRIGGER_IGNORED` is event only | Does not block future real process | Critical |
| `VALIDATION_FAILED` audit event uses same string as process status | Persisted in `invoice_events.event_type` when validation fails after process claim; not an `InvoiceProcessStatus` alias in code | Medium |
| `InvoiceRecord` existence blocks `createInvoice` permanently for process | Prevent duplicate invoice | Critical |
| No automatic retry for invoice creation | Prevent duplicate invoice | Critical |
| Timeout/unknown requires manual verification | Unknown if invoice was created | Critical |
| Technical retry outside UI V1 | Recovery without panel (panel deferred to V2) | High |
| No AI in V1 | Deterministic financial process | Critical |
| Security/observability/testing baselines accepted | Production safety | Critical |
| Fakturownia payload mapped from validated `InvoiceDraft` only | Keeps CRM validation separate from provider I/O | Critical |
| Fakturownia `FULL` → `kind: vat`; buyer + positions on invoice root | Standard VAT invoice via Fakturownia API | High |
| Fakturownia `ADVANCE` → `kind: advance` + `advance_creation_mode: amount` + `advance_value` | Advance amount from validated Bitrix field | High |
| Fakturownia `FINAL` → `kind: final` + `invoice_ids` from prior advance Fakturownia ID | Links final invoice to prior advance in provider | High |
| Fakturownia KSeF via `gov_status` → integration result only | No direct KSeF API in V1; workflow maps result in use case | High |
| V1 Fakturownia position mapping omits `unit`; provider default applies | `ProductLine.unit` is always `szt.`; not required in provider payload for V1 | Medium |
| `FAKTUROWNIA_*` env vars for client auth and timeout | Same pattern as Bitrix24 webhook config | Medium |
| Custom Fakturownia invoice numbering `{n}/{MM}/{YYYY}` via explicit `number` field | Evapremium monthly reset; slash format; bootstrap ENV for May 2026; auto-numbering disabled in Fakturownia | High |
| `invoice_number` in n8n email webhook from `fakturowniaInvoiceNumber` at create | Customer-facing number in mail template without extra Fakturownia GET | High |
| `ADVANCE` and `FINAL` require Fakturownia order linkage | Fakturownia API expects advance/final from order via `copy_invoice_from`; one `fakturownia_orders` row per `bitrix_deal_id` | Critical |
| V1 uses `fakturownia_orders` + `copy_invoice_from` at invoice creation | Persisted order ID links ADVANCE/FINAL payloads to provider order | High |
| Fakturownia order via `POST /invoices.json` with `kind: estimate` | Official Fakturownia API for Zamówienie documents | High |
| Order payload from validated `InvoiceDraft` with `oid` = `bitrixDealId` | Traceability; buyer + positions same as invoice mapping | High |
| `FakturowniaOrderService.createOrder` returns integration result only | DB insert via use case Task 9 | Medium |
| Customer email from deal-linked Bitrix24 contact (`CONTACT_ID` → `crm.contact.get` → first `EMAIL[].VALUE`) | Evapremium stores recipient on deal contact, not company UF; verified on deal 29134 | High |
| `customerEmail` validated before Fakturownia; normalized trim + lowercase in `InvoiceValidationService` | Blocks invoice without delivery path; codes `MISSING_CUSTOMER_EMAIL` / `INVALID_CUSTOMER_EMAIL` | High |

## Open decisions

| ID | Decision needed | Status | Blocks |
|---|---|---|---|
| `OPEN_DECISION_EMAIL_PROVIDER` | Which email provider/API (SMTP, transactional API) and env vars for V1 | **Open** | Task 11 integration implementation |
| `OPEN_DECISION_FAKTUROWNIA_PDF_SOURCE` | How to obtain PDF bytes for attachment (Fakturownia API endpoint vs link-only email) | **Open** | Task 11 attachment vs link-only template |
| `OPEN_DECISION_FAKTUROWNIA_POSITION_UNIT` | Whether Fakturownia requires explicit position unit (`szt.`) on create-invoice/order | **Deferred** — V1 omits unit field; verify if documents show wrong unit | Low; adjust mapper only if provider rejects or displays incorrect unit |
| `OPEN_DECISION_FAKTUROWNIA_ACCOUNT_SMOKE_TEST` | Verify create-order + ADVANCE/FINAL invoice with `copy_invoice_from` on Evapremium Fakturownia account | **Not verified** | Task 9 production wiring; may require payload adjustments |
| `OPEN_DECISION_FAKTUROWNIA_OID_UNIQUE` | Whether to send `oid_unique: yes` on order create to prevent duplicate provider orders on retry | **Deferred** — V1 uses `oid` only; DB unique on `bitrix_deal_id` prevents duplicate persistence | Medium; Task 9 retry/idempotency design |
| `OPEN_DECISION_FAKTUROWNIA_INVOICE_NUMBER_RACE` | Concurrent invoice creates may allocate same number without DB sequence lock | **Deferred** — V1 uses read-only API max + ENV bootstrap; acceptable for low parallel volume | Medium; add DB sequence table if parallel volume increases |

Context for `OPEN_DECISION_FAKTUROWNIA_ACCOUNT_SMOKE_TEST`:
- Create-order integration implemented (`FakturowniaOrderMapper`, `FakturowniaOrderService`, `FakturowniaClient.createOrder`).
- `copy_invoice_from` on invoice payload still not wired in `FakturowniaMapper`.
- **Owner:** Architect / Product Owner. **Verify before:** Task 9 production wiring.

## Deferred decisions / V2+
| Feature | Target |
|---|---|
| Simple client panel (one admin, process list) | V2 |
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
