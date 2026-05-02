# state.json schema

Each feature has its own `state.json` at `.mumei/specs/<feature-slug>/state.json`. It tracks the lifecycle of one feature from `plan` through `done`.

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Feature ID like `REQ-1`. Must match the User Story heading in `requirements.md`. |
| `slug` | string | yes | URL-safe slug used in directory names. Lowercase, kebab-case. |
| `phase` | enum | yes | `plan` / `implement` / `review` / `done`. |
| `approvals.requirements` | enum | yes | `draft` / `approved`. Set to `approved` after Coverage Check passes and user confirms. |
| `approvals.design` | enum | yes | Same. |
| `approvals.tasks` | enum | yes | Same. |
| `current_wave` | integer | yes | The Wave currently being implemented (0 if not yet started). |
| `created_at` | ISO 8601 string | yes | UTC timestamp of feature creation. |
| `updated_at` | ISO 8601 string | yes | UTC timestamp of last state mutation. Updated automatically by `mumei_state_set`. |

## Future fields

The schema includes only what v0.1 actually uses. Additional fields (review timestamps, archival metadata, etc.) are added when a real need arises — not preemptively. Skills MUST tolerate unknown fields when reading.

## Phase semantics

| Phase | Meaning | Gate to next phase |
|---|---|---|
| `plan` | Drafting requirements / design / tasks | All 3 approvals + Coverage Check zero missing |
| `implement` | Code is being written, Wave by Wave | All tasks `[x]` in tasks.md |
| `review` | 4-stage independent review + per-issue validation | Latest review verdict `PASS` |
| `done` | Ready to merge / deploy | (terminal) |

## Backwards compatibility

Future versions may add fields. Skills MUST tolerate unknown fields when reading. Use `jq -r '.field // empty'` style fallbacks.
