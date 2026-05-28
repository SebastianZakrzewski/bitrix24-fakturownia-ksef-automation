---
name: task
description: >-
  Creates, repairs, or validates a complete Cursor Task Template before
  implementation. MANDATORY when the user declares /task in the context window.
  Also use when the user asks to implement, fix, refactor, continue, add tests,
  run a task, or when an instruction is too short or ambiguous and must be
  converted into a structured task block before coding.
---

# TASK

## Purpose

Create, repair, or validate a complete Cursor Task Template before any implementation work.

This skill is used when:
- the user declares **`/task`** in the context window (prefix, slash command, or attached skill) — **always, no exceptions**;
- the user asks to implement code;
- the user says `fix`, `continue`, `next`, `wykonaj`, `napraw`, `add tests`, `refactor`;
- the current instruction is ambiguous;
- `08-task-template-enforcement.mdc` blocks coding;
- a task needs to be converted into a structured implementation contract.

This skill does not authorize coding by itself. It only prepares or validates the task block.

## Canonical template source

Copy the **Cursor Task Template** from [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc) exactly.

If a section does not apply, use the fallback structure below.

## Required task sections

Every production implementation task must include:

- TASK
- READ
- GOAL
- SCOPE
- FORBIDDEN
- BUSINESS BEHAVIOR
- TECHNICAL REQUIREMENTS
- VALIDATION
- EXPECTED OUTPUT

Use `N/A` only when a section truly does not apply.

## Fallback task structure

```text
TASK:
[Exact implementation task.]

READ:
[Docs-selection rule paths from `.cursor/rules/docs-selection/` + concrete `/docs` paths per `00-docs-selection-policy.mdc`.]

GOAL:
[Business or technical result.]

SCOPE:
[Files, modules, directories, or functions allowed to change.]

FORBIDDEN:
[What must not be changed or executed.]

BUSINESS BEHAVIOR:
Given [initial business/system state]
When [action/event happens]
Then [expected result]
And [forbidden side effect must not happen]

TECHNICAL REQUIREMENTS:
[Contracts, types, mappings, lifecycle rules, idempotency, error handling, tests.]

VALIDATION:
[Exact tests, commands, scenarios, assertions.]

EXPECTED OUTPUT:
[Files changed, tests added/updated, validation results, forbidden side effects asserted, open decisions.]
```

## `/task` — mandatory first response

When the user message starts with or includes **`/task`**:

1. **First response must be** the filled Cursor Task Template + **Approve this task for implementation?**
2. **Forbidden on first turn:** file edits, scaffolding, matrix/runner creation, test execution, live side effects — even if the user gave a long, detailed spec after `/task`.
3. **`/task` ≠ implement.** Approval words after a *previous* approved task do not apply to a new `/task` message.
4. Read-only exploration (repo, `/docs`) to fill READ/SCOPE/TECHNICAL REQUIREMENTS is OK.

## Workflow

1. Copy structure from [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc).
2. Infer scope from user message and open files; pick matching rules from `.cursor/rules/docs-selection/` per [`.cursor/rules/00-docs-selection-policy.mdc`](../../rules/00-docs-selection-policy.mdc).
3. Fill all required sections; use `N/A` only when truly N/A.
4. For short commands (`fix`, `continue`, `next`, `wykonaj`, `napraw`, `implement`, `add tests`): **stop** — no file edits, destructive commands, or external side effects.
5. Output proposed task block; ask: **Approve this task for implementation?**
6. On approval → hand off to [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc), [`.cursor/rules/06-task-execution-policy.mdc`](../../rules/06-task-execution-policy.mdc), and [`.cursor/rules/05-testing-task-execution.mdc`](../../rules/05-testing-task-execution.mdc) (pre-coding note, then code).

## Exceptions (task block not required)

- Questions, explanations, architecture discussion (no code changes) — **unless** prefixed with `/task`
- Tech Lead audit/review → [`.cursor/rules/07-tech-lead-audit-policy.mdc`](../../rules/07-tech-lead-audit-policy.mdc)
- User explicitly says: skip template / implement without task block — **does not override `/task`**
- Trivial, fully scoped one-liner with zero ambiguity — still output minimal pre-coding note — **does not apply when `/task` is declared**

## Blocked by missing decisions

Create `TODO_DECISION` (format in [reference.md](reference.md)); stop affected implementation; ask for clarification.

## Additional resources

- Full template, pre-coding note, TODO_DECISION, checklist, docs-selection table, minimal example: [reference.md](reference.md)
