# mumei

> Quality Enforcement Layer for Claude Code.
> Stop the agent from skipping spec phases, Wave commits, and reviews — structurally.

`mumei` is a Claude Code plugin that physically enforces a spec-driven development workflow:

```
brainstorm → plan (with Coverage Check) → implement (Wave gate) → review (4-stage independent + per-issue validation) → done
```

It does not rely on prompt-level instructions ("you must run tests") that the agent can ignore. It uses Claude Code Hooks to deny tool calls that violate the workflow at the OS boundary.

## Why

AI coding agents skip steps. They mark tasks complete without writing tests. They commit with failing tests. They invent requirements that the user never asked for. They claim a feature is done before review runs.

`mumei` blocks those moves at the tool-call layer:

- Cannot edit `src/` while a feature's spec is incomplete.
- Cannot `git commit` while a Wave has incomplete tasks.
- Cannot `git push` while the latest review verdict is `MAJOR_ISSUES`.
- Cannot mark a task `[x]` without an actual implementation diff.
- Cannot end a session with all tasks done but review skipped.

## Workflow

### 1. One-time setup per project

```
/mumei:init
```

Creates `.mumei/` directory structure, proposes additions to `CLAUDE.md` (with diff preview and explicit approval), and verifies the setup.

### 2. Brainstorm a feature (optional but recommended)

```
/mumei:brainstorm user-auth
```

Up to 5 questions × 3 rounds. Output saved to `.mumei/scratch/user-auth.md`. Used as input for `/mumei:plan`.

### 3. Generate the spec

```
/mumei:plan user-auth
```

Walks through:

- **Phase 1**: requirements draft (User Story + EARS-format acceptance criteria + assumptions + open questions).
- **Phase 1.5 — Coverage Check**: extracts conversation requirements, validates against the draft. Blocks downstream phases if anything the user said is missing from the spec, or if the spec invented requirements with no source.
- **Phase 2**: design draft (architecture diagram, data model, components, trade-offs, Wave plan).
- **Phase 3**: tasks draft (Wave > Task hierarchy with `_Files:_`, `_Depends:_`, `_Requirements:_` meta).

Each phase is gated. You cannot draft `design.md` while `requirements.md` has unresolved `[NEEDS CLARIFICATION]` markers, etc.

### 4. Implement Wave by Wave

Implement the tasks in Wave 1. Mark `[x]` as you go. Hooks verify:

- The implementation files actually changed (no phantom completion).
- You did not edit files outside the task's `_Files:_` scope.
- Tests pass before commit.
- Commit happens before starting the next Wave.

### 5. Review

When all tasks are `[x]`, `/mumei:plan` invokes the review pipeline:

```
Stage 1 (parallel):
  ├─ spec-compliance-reviewer  (Sonnet, memory: project)
  ├─ code-quality-reviewer     (Sonnet, memory: project)
  └─ security-reviewer         (Opus,   memory: project)
Stage 2 (sequential):
  └─ adversarial-reviewer      (Opus,   memory: project, prior_findings)
Stage 3: aggregate findings
Stage 4 (parallel): per-issue-validator (Sonnet, memory: local, read-only) — one per finding
Stage 5: filter to valid only
Stage 6: write reviews/<timestamp>.json + update state
```

Each reviewer is independent (fresh context). No reviewer sees its own prior runs — only the project memory it has built up.

### 6. Done

When the review verdict is `PASS`, the feature transitions to `phase: done`.

```
/mumei:archive user-auth
```

Moves the feature to `.mumei/archive/<YYYY-MM>/user-auth/`.

## Installation

`mumei` is in pre-release (v0.1.0). Marketplace publication is TBD. For now, install via local plugin directory:

```bash
git clone https://github.com/<owner>/mumei.git ~/path/to/mumei

# Start Claude Code with the local plugin loaded:
claude --plugin-dir ~/path/to/mumei
```

`--plugin-dir` loads the plugin in-place (no cache copy), which is the recommended path during pre-release. Once mumei stabilizes and a marketplace entry is published, `claude plugin install` will be the standard route.

After Claude Code starts, run `/mumei:init` once per project to set up the `.mumei/` directory and `CLAUDE.md` additions.

## Project layout (after `/mumei:init`)

```
your-project/
├── CLAUDE.md                              # mumei conventions are appended here
├── .mumei/
│   ├── current                            # active feature slug (1 line)
│   ├── specs/
│   │   └── REQ-1-user-auth/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       ├── tasks.md
│   │       ├── state.json
│   │       ├── coverage-check.json
│   │       └── reviews/
│   │           └── 2026-05-03T15-45-00.json
│   ├── archive/
│   │   └── 2026-04/
│   │       └── REQ-old-feature/
│   └── scratch/                           # gitignored
│       └── user-auth.md                   # /mumei:brainstorm output
└── .gitignore                             # adds .mumei/scratch/, .claude/agent-memory-local/
```

## Spec document format

`mumei` uses **User Story + EARS acceptance criteria + inline annotations**:

```markdown
# User Auth Requirements

## User Story
As a registered user, I want to log in with email and password, so that I can access my data.

## Acceptance Criteria
- REQ-1.1 [CONFIRMED] WHEN the user submits valid credentials, the system SHALL issue a session cookie.
- REQ-1.2 [CONFIRMED] IF 5 consecutive logins fail, then the system SHALL lock the account for 15 minutes.
- REQ-1.3 [ASSUMPTION] WHILE the user is logged in, the system SHALL refresh the session every 30 minutes.
- REQ-1.4 [NEEDS CLARIFICATION: which IdP?] WHERE SSO is enabled, the system SHALL delegate to the configured IdP.

## Out of Scope
- MFA (deferred to v2)

## Assumptions
- Bcrypt for password hashing (industry default)
```

Annotations:

- `[CONFIRMED]`: backed by user statement or existing artifact.
- `[ASSUMPTION]`: reasonable inference, not explicitly stated by the user.
- `[NEEDS CLARIFICATION: <question>]`: blocks `phase: design` until resolved.

## Tasks document format

```markdown
# User Auth Implementation Plan

## Wave 1: Setup
**Goal**: Establish the user model and DB schema.
**Verify**: `npm run db:migrate` succeeds.

- [ ] 1.1 Create User model in src/models/user.ts
  - _Files: src/models/user.ts_
  - _Depends: -_
  - _Requirements: REQ-1.1_
- [ ] 1.2 Add migration for users table
  - _Files: migrations/20260503_users.sql_
  - _Depends: 1.1_
  - _Requirements: REQ-1.1_

## Wave 2: Login flow
**Goal**: Email/password login + session cookie.
**Verify**: `npm test -- src/auth/login.test.ts` passes.

- [ ] 2.1 ...
```

The `_Files:_`, `_Depends:_`, `_Requirements:_` lines are **mandatory**. They power the hook gates. Without them, `mumei` cannot enforce scope or order.

## Hook rules (full list)

| ID | Phase | Hook | Trigger |
|---|---|---|---|
| P1 | plan | PreToolUse(Edit\|Write) | Editing `src/` while spec incomplete |
| P2 | plan | PreToolUse(Write) | Creating `design.md` with `[NEEDS CLARIFICATION]` in `requirements.md` |
| P3 | plan | PreToolUse(Write) | Creating `tasks.md` without `design.md` |
| I1 | implement | PreToolUse(Edit\|Write) | Editing a file owned by a task whose deps are not complete |
| I2 | implement | PreToolUse(Edit\|Write) | Editing a file not in any task's `_Files:_` (scope creep) |
| I3 | implement | PreToolUse(Bash) | `git commit` with failing tests |
| I4 | implement | PostToolUse(Edit) | Marking `[x]` without an implementation diff |
| W1 | implement | PreToolUse(Edit\|Write) | Editing Wave N+1 file before Wave N is committed |
| W2 | implement | PreToolUse(Bash) | `git commit` while current Wave has `[ ]` tasks |
| R1 | review | Stop | Session ending with all tasks done but review skipped |
| R2 | review | PreToolUse(Bash) | `git push` while latest review verdict is `MAJOR_ISSUES` |
| X1 | any | PostToolUse(Bash) | Bash modified files outside scope (advisory only) |

## Escape hatch

```
MUMEI_BYPASS=1 claude
```

Skips all hook gates. Use sparingly. There is no other escape hatch — no `--no-verify`, no `mumei skip`, no per-rule disable. By design.

## What `mumei` is NOT

- Not a CI/CD tool. Hooks run inside Claude Code only.
- Not a code review service. Reviewers run locally via your Claude Code subscription.
- Not a SDD adapter. mumei has its own opinionated spec format. If you use spec-kit / spec-workflow / tsumiki / cc-sdd, mumei does not integrate with them — they live in parallel.
- Not multi-tool. Cursor / Codex / Aider are not supported. The physical enforcement layer is Claude Code Hooks.
- Not a storage system. State is plain files. No DB, no MCP server.

## Status

Pre-release (v0.1.0). Expect breaking changes until v1.0.

## License

MIT
