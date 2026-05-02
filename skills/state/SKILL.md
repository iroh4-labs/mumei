---
name: state
description: Internal helper for reading and writing .mumei/specs/<feature>/state.json. Used by other skills (plan, archive) and hook handlers via shared shell library. Not for direct user invocation.
user-invocable: false
allowed-tools: [Read, Bash, Glob]
---

<!--
役割: state.json の CRUD を抽象化する内部 skill
入力: 他の skill / orchestrator から呼ばれる
出力: state.json の内容、または更新後の状態
原則: ユーザー直接起動禁止。常に bash helper (hooks/_lib/state.sh) を経由する
-->

# Internal: state management

This skill is **not user-invocable**. It exists as a documented helper for other skills (`plan`, `archive`) and hook handlers to read and write `.mumei/specs/<feature>/state.json` consistently.

When another skill or agent needs to manipulate state, it MUST go through the helper functions defined in `hooks/_lib/state.sh`. Do NOT write directly to `state.json` from arbitrary skills — atomic write semantics and schema validation depend on going through the helper.

## State schema

See `resources/state-schema.md` and `schemas/state.schema.json` for the full schema.

In short:

```json
{
  "id": "REQ-1",
  "slug": "user-auth",
  "phase": "plan|implement|review|done",
  "approvals": {
    "requirements": "draft|approved",
    "design": "draft|approved",
    "tasks": "draft|approved"
  },
  "current_wave": 0,
  "created_at": "2026-05-03T10:00:00Z",
  "updated_at": "2026-05-03T15:45:00Z"
}
```

## Helper functions

Source `hooks/_lib/state.sh` and call:

- `mumei_current_feature` — read `.mumei/current` (active feature slug).
- `mumei_state_init <feature> <slug> <id>` — create initial `state.json` for a new feature.
- `mumei_state_phase <feature>` — get current phase.
- `mumei_state_approval <feature> <key>` — get approval status (`requirements`/`design`/`tasks`).
- `mumei_state_set <feature> <jq_path> <json_value>` — set a single field atomically.
- `mumei_state_get <feature> <jq_path>` — read a single field.
- `mumei_state_write_full <feature>` — overwrite `state.json` (reads stdin).

Example invocation in a skill (executed via Bash tool):

```bash
source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/state.sh"
feature="$(mumei_current_feature)"
mumei_state_set "$feature" '.phase' '"implement"'
```

## Phase transition rules

Phase progresses linearly:

```
plan → implement → review → done
```

Each transition is gated:

- `plan → implement`: requires `approvals.requirements`, `approvals.design`, `approvals.tasks` all to be `approved`, AND Coverage Check `missing_count = 0`.
- `implement → review`: requires all tasks in `tasks.md` to be `[x]`.
- `review → done`: requires latest review verdict to be `PASS` (not `MAJOR_ISSUES` or `NEEDS_IMPROVEMENT`).

These rules are enforced by hooks. State transitions themselves are made by the `plan` skill via the helper functions above.

## Don'ts

- Do NOT write directly to `.mumei/specs/<feature>/state.json` without going through the helper.
- Do NOT bypass phase transition gates from within a skill (the hook will deny anyway, but skills should not try).
- Do NOT cache state values across operations — always re-read.
