---
name: init
description: One-time setup for a project to use mumei. Detects existing CLAUDE.md / .claude/rules/, proposes additions about mumei's expectations (phase gates, Wave commits, review pipeline), and applies them with user approval. Triggers when the user says "set up mumei", "install mumei", or "initialize mumei in this project".
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

<!--
役割: プロジェクトに mumei を導入する一回限りのセットアップ
入力: ユーザーの指示
出力: .mumei/ ディレクトリ作成 + CLAUDE.md / .claude/rules/ への追記提案
原則: ユーザー同意なしに既存ファイルを書き換えない (claude-md-improver パターン)
-->

# Init

Set up `mumei` for the current project. This skill is run **once** per project. It:

1. Creates the `.mumei/` directory structure.
2. Detects existing `CLAUDE.md` / `.claude/rules/*.md`.
3. Proposes additions about mumei's expectations and applies them with explicit user approval.

## When to use

- The user explicitly says "set up mumei", "install mumei in this project", or invokes `/mumei:init`.
- The first time `/mumei:plan` is invoked in a project where `.mumei/` does not exist (route to this skill first).

## Method

### Step 1 — Detect existing project memory

Read all of:

- `CLAUDE.md` (project root)
- `.claude/CLAUDE.md`
- `~/.claude/CLAUDE.md` (user-level, read-only)
- `.claude/rules/*.md`
- `AGENTS.md` (if present)

Summarize what is currently in place. Do NOT modify anything yet.

### Step 2 — Create `.mumei/` directory

```bash
mkdir -p .mumei/specs .mumei/archive .mumei/scratch
[[ -f .mumei/current ]] || : > .mumei/current  # empty until first feature
```

Add `.gitignore` entries idempotently. Always check before appending so re-running this skill does not add duplicates:

```bash
add_gitignore_line() {
  local pattern="$1"
  [[ -f .gitignore ]] || touch .gitignore
  grep -qxF "$pattern" .gitignore || printf '%s\n' "$pattern" >> .gitignore
}

add_gitignore_line ".mumei/scratch/"
add_gitignore_line ".claude/agent-memory-local/"
```

`.mumei/scratch/` keeps brainstorm output local-only. `.claude/agent-memory-local/` is the per-issue-validator's memory directory (local scope).

### Step 3 — Propose CLAUDE.md additions

Show the user the diff BEFORE writing. The proposed addition:

```markdown
## mumei (Quality Enforcement Layer)

This project uses [mumei](https://github.com/.../mumei) for spec-driven development and physical-enforcement of phase transitions.

### Workflow

1. `/mumei:brainstorm <topic>` — structured brainstorm before specing
2. `/mumei:plan <feature>` — generate requirements / design / tasks (with Coverage Check)
3. Implement Wave by Wave; commit after each Wave completes
4. `/mumei:plan` re-invocation triggers the 4-stage review when all tasks are `[x]`
5. `/mumei:archive <feature>` after the feature is done

### Conventions

- Spec docs live under `.mumei/specs/<feature-slug>/{requirements,design,tasks}.md`.
- Each task in `tasks.md` MUST include `_Files:_`, `_Depends:_`, `_Requirements:_` meta lines.
- Each Wave is a single commit unit. Hooks block commits with incomplete Waves and pushes with `MAJOR_ISSUES` review verdicts.
- Bypass for emergencies: `MUMEI_BYPASS=1` (use sparingly).
```

Ask the user: "Apply this addition to your CLAUDE.md? (yes / edit / no)".

- `yes` → `Edit` to append.
- `edit` → let user customize, then apply.
- `no` → skip, proceed to next step.

### Step 4 — Optional: propose `.claude/rules/` rule

If `.claude/rules/` exists, propose adding `.claude/rules/mumei.md` with `paths: [".mumei/**/*.md"]` so that mumei conventions are auto-loaded when editing spec files. Same yes/edit/no flow.

### Step 5 — Verify

Run a self-check:

```bash
test -d .mumei/specs
test -d .mumei/archive
test -d .mumei/scratch
test -f .gitignore && grep -q "\.mumei/scratch" .gitignore
```

Report success or what is missing.

### Step 6 — Suggest first feature

> Setup complete. To create your first feature, run `/mumei:brainstorm <topic>` for an interactive brainstorm, or `/mumei:plan <feature-slug>` if you already know what you want.

## Idempotency

This skill is safe to re-run. It will:

- Skip directory creation if dirs exist.
- Detect already-applied CLAUDE.md additions and skip them.
- Re-verify the setup at the end.

## Don'ts

- Don't modify `CLAUDE.md` without showing the diff and getting explicit user approval. The user may have customized it.
- Don't write to `~/.claude/CLAUDE.md` (user-global). It is read-only context.
- Don't overwrite existing `.gitignore` patterns; append only.
- Don't create a default `.mumei/specs/REQ-1-example/` — leave the spec dir empty until the user creates a real feature.
- Don't run more than once silently. If `.mumei/` already exists, ask "re-init?" before doing anything.
