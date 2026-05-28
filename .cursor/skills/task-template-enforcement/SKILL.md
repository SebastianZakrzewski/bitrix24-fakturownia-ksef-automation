---
name: task-template-enforcement
description: >-
  Enforce the SellGenius Cursor Task Template before any implementation.
  MANDATORY when the user declares /task in the context window. Converts short
  or ambiguous user requests into a filled task block from
  `08-task-template-enforcement.mdc`, gates coding on user approval, outputs the
  pre-coding note, and closes with EXPECTED OUTPUT. Use when the user starts
  implementation work, gives short commands (fix, continue, next, implement),
  asks to scope a task, says approved/implement, or mentions task template,
  task skeleton, or docs-selection gate.
---

# Task Template Enforcement

Gate all implementation on a complete, approved task block. Canonical template: [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc).

## `/task` in context window (hard trigger)

When the user declares **`/task`**: first response = filled task template + approval question. No file edits or implementation on that turn. See [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc) § `/task` and [`.cursor/skills/task/SKILL.md`](../task/SKILL.md).

## Gate — do NOT code until

1. Every required section is present and specific (no vague "fix the bug").
2. User confirms the task block **or** explicitly approves your proposed filled template.

| Section | Required when |
|---------|----------------|
| TASK | always |
| READ | always (docs-selection category + concrete `/docs` paths) |
| GOAL | always |
| SCOPE | always |
| FORBIDDEN | always (include global forbidden items from template) |
| BUSINESS BEHAVIOR | functional tasks (Given/When/Then + forbidden side effect) |
| TECHNICAL REQUIREMENTS | always |
| VALIDATION | always |
| EXPECTED OUTPUT | always |

Use `N/A` only when a section truly does not apply. Skeleton/setup tasks: mark TYPE; BUSINESS BEHAVIOR may be `N/A`.

## When instruction is short or ambiguous

Examples: "fix this", "continue", "next", "implement", "add tests", "do a live test", "wykonaj".

1. **Stop** — no file edits, destructive commands, or external side effects.
2. Propose a filled task from [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc) (minimum format in [`.cursor/rules/09-short-instruction-policy.mdc`](../../rules/09-short-instruction-policy.mdc) for trivial scope; full template when lifecycle, DB, integrations, or side effects are involved).
3. Ask: **Approve this task for implementation?**

## After gate passes

1. Read docs listed in READ per [`.cursor/rules/00-docs-selection-policy.mdc`](../../rules/00-docs-selection-policy.mdc).
2. Output the **agent pre-coding note** (see [reference.md](reference.md)).
3. Implement only within SCOPE; respect FORBIDDEN.
4. Run VALIDATION commands; report results in EXPECTED OUTPUT.
5. Run completion checklist from [`.cursor/rules/05-testing-task-execution.mdc`](../../rules/05-testing-task-execution.mdc) before claiming done.

## On "approved" or "implement"

Implement **only** the last explicitly approved task. Do not expand scope, add V2/V3, or change undocumented architecture.

## Exceptions (template not required)

- Questions, explanations, architecture discussion (no code changes) — **unless** `/task` is declared
- Tech Lead audit/review → [`.cursor/rules/07-tech-lead-audit-policy.mdc`](../../rules/07-tech-lead-audit-policy.mdc)
- User explicitly says: skip template / implement without task block — **does not override `/task`**
- Trivial, fully scoped one-liner — **does not apply when `/task` is declared**

## Blocked by missing decisions

Create `TODO_DECISION` (format in [reference.md](reference.md)); stop affected implementation; ask for clarification.

## Live testing

Do not execute live side effects without a controlled live-test task and explicit approval. Minimum flags: `LIVE_TEST_MODE`, `LIVE_TEST_CONFIRM`, `ENABLE_EXTERNAL_SIDE_EFFECTS`, `ALLOW_TEST_DEAL_CREATION`, `TEST_DEAL_PREFIX`. See `.env.example` and `scripts/live-tests/`.

## Related rules

- [`.cursor/rules/08-task-template-enforcement.mdc`](../../rules/08-task-template-enforcement.mdc)
- [`.cursor/rules/06-task-execution-policy.mdc`](../../rules/06-task-execution-policy.mdc)
- [`.cursor/rules/05-testing-task-execution.mdc`](../../rules/05-testing-task-execution.mdc)

## Additional resources

- Full template, pre-coding note, TODO_DECISION, checklist, docs-selection table: [reference.md](reference.md)
