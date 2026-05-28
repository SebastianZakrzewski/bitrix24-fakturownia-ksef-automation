# Cursor Implementation Rules V1

## Mandatory rules
1. Read all `/docs` files before implementation.
2. Implement V1 only.
3. Do not implement V2/V3 features unless explicitly requested later.
4. Do not invent new concepts, statuses, enums, endpoints, modules or DB tables.
5. Do not rename accepted concepts without updating all docs and receiving approval.
6. Do not put critical financial logic in n8n, controllers, repositories or integrations.
7. Business rules belong in `invoices` use cases/services.
8. Repositories only persist and read data.
9. Integrations only communicate with external systems and map provider payloads/results.
10. Bitrix24 module must not decide invoice correctness.
11. Fakturownia integration must not decide whether invoice creation is allowed.
12. No `any`. Use explicit types and `unknown` where external raw data is not yet mapped.
13. Never log API tokens, NIP, addresses or full raw payloads in ordinary logs.
14. No automatic invoice deletion/cancellation in V1.
15. No manual invoice creation from client panel in V1.
16. No AI/LLM in V1 invoice decision path.

## Model separation
| Model | Meaning |
|---|---|
| DTO | HTTP request/response contract |
| Command | Use-case input after DTO validation/mapping |
| Domain/Application type | Internal business process type |
| Persistence model | DB schema/entity |
| Integration type | External provider payload/result/raw response |

Never mix raw Bitrix/Fakturownia API response with domain models.

## Required implementation flow
```text
Controller DTO
  -> DTO validation
  -> map DTO to Command
  -> UseCase
  -> Services/Repositories/Integrations
  -> Response DTO
```

## Side effect rules
- No Fakturownia call before validation passes.
- Set `INVOICE_CREATION_IN_PROGRESS` before Fakturownia call.
- Save `InvoiceRecord` immediately after confirmed Fakturownia success.
- Existing `InvoiceRecord` permanently blocks another `createInvoice` call.
- Bitrix sync retry must never call Fakturownia.
- Timeout/unknown blocks invoice creation retry until manual review.

## DB rules
- Enforce `unique(bitrix_deal_id, invoice_type)`.
- Enforce `unique(idempotency_key)`.
- Enforce one `invoice_record` per `invoice_process`.
- `STALE_TRIGGER_IGNORED` is an event only, not an `InvoiceProcess` status.

## Testing rules
Each task must include relevant tests:
- unit tests for business rules,
- integration tests for DB/constraints when affected,
- API tests for endpoint behavior when affected,
- forbidden side effects tests for invoice safety.

No task is done unless type-check/build/tests pass.

## Workspace Cursor rules (`.cursor/rules/`)

| Rule | Purpose |
|------|---------|
| `01-core-implementation-agent.mdc` | V1 scope, docs index |
| `06-task-execution-policy.mdc` | Structured tasks, scope |
| `08-task-template-enforcement.mdc` | Full task template gate; **`/task` in context = template first, no coding until approval** |
| `09-short-instruction-policy.mdc` | Short commands → proposal → approval; includes `/task` handling |
| `07-tech-lead-audit-policy.mdc` | Review/audit output format |

Task copy-paste template: inline in `08-task-template-enforcement.mdc` (referenced by `06`/`08`/`09`).

## Cursor task output expectation
For each task, implementation must provide:
- files changed,
- business process step implemented,
- validation scenarios covered,
- forbidden side effects asserted,
- build/test result.
