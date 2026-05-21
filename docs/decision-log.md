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
| `InvoiceRecord` existence blocks `createInvoice` permanently for process | Prevent duplicate invoice | Critical |
| No automatic retry for invoice creation | Prevent duplicate invoice | Critical |
| Timeout/unknown requires manual verification | Unknown if invoice was created | Critical |
| Simple client panel V1 | Basic visibility without scope creep | High |
| One panel admin account in V1 | Simple auth | Medium |
| Technical retry outside panel V1 | Recovery without UI complexity | High |
| No AI in V1 | Deterministic financial process | Critical |
| Security/observability/testing baselines accepted | Production safety | Critical |

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
