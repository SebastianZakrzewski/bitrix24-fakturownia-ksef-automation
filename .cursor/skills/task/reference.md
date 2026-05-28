# TASK Reference

Canonical template: [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc). This file is for agent lookup when filling or validating a task block.

## User task block

```text
TASK:
[Clear task name]

READ:
Use docs selection policy (`.cursor/rules/00-docs-selection-policy.mdc`).

Docs-selection rules (list concrete paths that apply):
- `.cursor/rules/docs-selection/<rule>.mdc`

Docs (always + paths from selected category rules):
- /docs/decision-log.md
- /docs/<...>

GOAL:
[One precise result of this task]

SCOPE:
- [Allowed change 1]
- [Allowed change 2]

FORBIDDEN:
- Do not implement V2/V3 features.
- Do not invent undocumented statuses, event types, DTOs, modules, endpoints, tables or business rules.
- Do not change accepted architecture unless explicitly requested.
- Do not execute external side effects unless explicitly approved.
- [Task-specific forbidden item]

BUSINESS BEHAVIOR:
Given:
- [Initial condition]
When:
- [Action]
Then:
- [Expected result]
Forbidden side effect:
- [What must not happen]

TECHNICAL REQUIREMENTS:
- Modify/create only:
  - [file/module 1]
- Keep controllers thin; repositories persistence-only; integrations provider-only.

VALIDATION:
- npm run typecheck
- npm run build
- npm run lint
- npm test
- npm run test:integration  # if DB/persistence/idempotency touched
- npm run test:e2e           # if API behavior touched

EXPECTED OUTPUT:
- files changed
- docs inspected
- tests added/updated
- validation result
- forbidden side effects asserted
- remaining open decisions
- deviation risks

TYPE: [ ] functional  [ ] skeleton/setup
```

## Agent pre-coding note

```text
Task:
- <repeat TASK one-liner>

Docs read:
- <paths actually opened>

Business process step:
- <mapped step from /docs/business-process-map.md>

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

## TODO_DECISION

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

## Completion checklist

- [ ] V1 only; matches `/docs`; no undocumented statuses/enums/DB fields
- [ ] Layers respected; no business logic in controller/repo/integration
- [ ] Validation and idempotency order; no side effect before validation
- [ ] Tests: happy path + invalid input + forbidden side effects where applicable
- [ ] VALIDATION commands run; results reported
- [ ] No secrets in logs; no unjustified `any`
- [ ] No unresolved TODO_DECISION in completed scope

## Minimal proposal (short instructions)

Use when scope is small and non-trivial areas are not touched:

```text
TASK:
[clear task name]

READ:
- Use docs selection policy (`.cursor/rules/00-docs-selection-policy.mdc`).
- List relevant docs category if clear.
- Always include /docs/decision-log.md.

GOAL:
[one precise outcome]

SCOPE:
- [allowed change 1]

FORBIDDEN:
- Do not implement V2/V3 features.
- Do not invent undocumented architecture.
- Do not execute external side effects unless explicitly approved.
- Do not modify files outside task scope.

VALIDATION:
- npm run typecheck
- npm run build
- npm run lint
- npm test

OUTPUT:
- files changed
- tests added/updated
- validation result
- remaining open decisions
- deviation risks
```

Then ask: **Approve this task for implementation?**

## Docs-selection

Per `.cursor/rules/00-docs-selection-policy.mdc`:

- List concrete paths under `.cursor/rules/docs-selection/` that match the task (read each rule's `description`, `globs`, and doc list).
- Do not hardcode integration or module names in the task block; use rule file paths and `/docs` paths from those rules.
- Multi-area: merge doc lists and dedupe paths.
- Audit tasks: use `docs-selection/90-tech-lead-audit.mdc`.

## Minimal filled example

```text
TASK:
Align technical-retry response DTO with contracts.md

READ:
Docs-selection:
- `.cursor/rules/docs-selection/30-dto-api-controllers.mdc`
Docs:
- /docs/decision-log.md
- /docs/contracts.md
- /docs/boundaries-workflow.md
- /docs/security-observability-testing.md

GOAL:
Response DTO fields match contracts.md for technical-retry endpoint.

SCOPE:
- technical-retry-response.dto.ts and related mapper/tests if any

FORBIDDEN:
- No new endpoints; no lifecycle/status changes; no external provider calls

BUSINESS BEHAVIOR:
Given: operator requests technical-retry status
When: API returns response
Then: payload matches documented contract fields
Forbidden side effect: no irreversible external side effects or DB writes outside scope

TECHNICAL REQUIREMENTS:
- Modify only DTO + tests under src/api/

VALIDATION:
- npm run typecheck
- npm run build
- npm test

EXPECTED OUTPUT:
- DTO diff, contract reference, test list, build/test pass/fail

TYPE: functional
```
