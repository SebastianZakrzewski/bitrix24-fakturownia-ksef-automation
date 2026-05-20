# Task skeleton (SellGenius / postsale_agent_V00)

Copy this block into chat when starting work. Fill every section; leave `N/A` only where truly not applicable.

Based on: `.cursor/rules/06-task-execution-policy.mdc`, `05-testing-task-execution.mdc`, `01-core-implementation-agent.mdc`, `docs-selection/`.

---

## User task (required before coding)

```text
TASK:
<one-line name, e.g. "Add technical-retry response field X">

READ:
Rules:
- .cursor/rules/01-core-implementation-agent.mdc
- .cursor/rules/02-architecture-boundaries.mdc
- .cursor/rules/03-model-separation.mdc
- .cursor/rules/04-safety-lifecycle-idempotency.mdc
- .cursor/rules/05-testing-task-execution.mdc
- .cursor/rules/06-task-execution-policy.mdc
Docs-selection category (pick one or more; delete rest):
- [ ] 10-db-persistence
- [ ] 20-lifecycle-statuses
- [ ] 30-dto-api-controllers
- [ ] 40-validation-mapping
- [ ] 50-bitrix24
- [ ] 60-fakturownia
- [ ] 70-testing
- [ ] 80-invoice-workflow
Docs (list concrete paths after reading docs-selection; always include decision-log):
- /docs/decision-log.md
- /docs/<...>

SCOPE:
Included:
- <what to implement>
Excluded:
- <explicit out of scope / V2>

FORBIDDEN:
- <files/modules not to touch>
- <behaviors that must not happen, e.g. Fakturownia before validation>

VALIDATION:
- npm run build  # or: npm run typecheck — use project standard
- npm test
- npm run test:integration  # only if DB/schema/constraints affected

OUTPUT:
- files changed
- business-process-map step implemented
- tests/scenarios covered (incl. forbidden side effects)
- build/test results
```

---

## Task type

```text
TYPE: [ ] functional  [ ] skeleton/setup
```

**Skeleton/setup only:** structure/stubs; no fake DB IDs; no invented error codes; `NotImplementedException` where logic needs DB/business rules.

**Functional:** tests for business rules and forbidden side effects; validation before side effects; V1 only.

---

## Business mapping (required for functional)

```text
BUSINESS_PROCESS_STEP:
- Source: /docs/business-process-map.md
- Step ID / name: <e.g. "Validate deal data before Fakturownia">
- If unmapped: TODO_DECISION or OUT_OF_SCOPE_FOR_V1
```

---

## Agent pre-coding note (agent outputs this, then codes)

```text
Task:
- <repeat TASK one-liner>

Docs read:
- <paths actually opened>

Business process step:
- <from business-process-map>

V1 scope:
- included: <...>
- excluded: <...>

Files planned:
- <paths create/change>

Validation:
- <commands from VALIDATION>

Open decisions:
- <TODO_DECISION blocks or "none">
```

---

## TODO_DECISION (if blocked)

```text
TODO_DECISION:
- Decision needed:
- Context:
- Why it blocks safe implementation:
- Affected module/files:
- Suggested options:
- Recommended default, if safe:
- Owner: Architect/Product Owner
```

---

## Completion checklist (agent before claiming done)

- [ ] V1 only; matches `/docs`; no undocumented statuses/enums/DB fields
- [ ] Layers respected (02/03); no business logic in controller/repo/integration
- [ ] Validation and idempotency order (04); no side effect before validation
- [ ] Tests: happy path + invalid input + forbidden side effects where applicable
- [ ] `npm test` fast path OK; integration only via `test:integration` if DB touched
- [ ] No secrets in logs; no unjustified `any`
- [ ] No unresolved TODO_DECISION in completed scope

---

## Quick docs-selection reference

| Category | Rule file | Typical `/docs` |
|----------|-----------|-----------------|
| DB | `10-db-persistence` | database-schema, domain-lifecycle, contracts, modules-reliability, security-observability-testing, decision-log |
| Lifecycle | `20-lifecycle-statuses` | domain-lifecycle, business-process-map, modules-reliability, decision-log |
| DTO/API | `30-dto-api-controllers` | contracts, boundaries-workflow, security-observability-testing, decision-log |
| Validation | `40-validation-mapping` | business-process-map, contracts, domain-lifecycle, modules-reliability, decision-log |
| Bitrix24 | `50-bitrix24` | boundaries-workflow, contracts, modules-reliability, security-observability-testing, decision-log |
| Fakturownia | `60-fakturownia` | contracts, modules-reliability, domain-lifecycle, security-observability-testing, decision-log |
| Testing | `70-testing` | security-observability-testing, business-process-map, modules-reliability, domain-lifecycle, decision-log |
| Full workflow | `80-invoice-workflow` | business-process-map, mvp-roadmap, boundaries-workflow, domain-lifecycle, contracts, database-schema, modules-reliability, security-observability-testing, decision-log |

Multi-area: merge lists and dedupe paths.

---

## Minimal example (filled)

```text
TASK:
Align technical-retry response DTO with contracts.md

READ:
Rules: 01–06 + docs-selection/30-dto-api-controllers
Docs:
- /docs/decision-log.md
- /docs/contracts.md
- /docs/boundaries-workflow.md
- /docs/security-observability-testing.md

SCOPE:
Included: technical-retry-response.dto.ts + related mapper/tests if any
Excluded: use-case logic, Fakturownia, DB schema

FORBIDDEN:
- No new endpoints; no lifecycle/status changes; no Fakturownia/Bitrix calls

VALIDATION:
- npm run build
- npm test

OUTPUT:
- DTO diff, contract reference, test list, build/test pass/fail

TYPE: functional

BUSINESS_PROCESS_STEP:
- business-process-map: technical retry / operator recovery (reference section name)
```
