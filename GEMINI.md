# Gemini reviewer context

This file is loaded automatically by gemini-cli when the
[`gemini-cli-extensions/code-review`](https://github.com/gemini-cli-extensions/code-review)
extension reviews a pull request via `.github/workflows/gemini-review.yml`.
It supplies project-specific context so the reviewer flags the
right things and stays away from the wrong things.

The same conventions are documented in `CONTRIBUTING.md` for human
contributors. This file is the reviewer-side mirror.

## What mumei is

mumei is a Claude Code plugin: a quality enforcement layer that
enforces SDD phases, Wave-by-Wave commits, and review pipelines via
hook-level gates rather than prompt-level instructions. It ships as
a `git archive` tarball; runtime is `bash` + `jq` so the install
footprint is zero (no Python venv, no Node runtime).

The repo is a small monorepo:

- **Plugin payload (shipped to users)**: `.claude-plugin/`,
  `agents/`, `skills/`, `hooks/` (handlers and `_lib/`),
  `schemas/` (shared JSON Schemas), `scripts/` (lint + aggregate),
  `tests/` (bats), top-level `README*.md` / `LICENSE` /
  `CONTRIBUTING.md` / `SECURITY.md` / `PRIVACY.md` /
  `CODE_OF_CONDUCT.md`.
- **Dashboard sub-project**: `dashboard/` — Vite + React 19 +
  Fastify 5 + Tailwind v4 + TanStack Query + Biome. Distributed
  separately on npm as `@mumei/dashboard`. Excluded from the
  plugin tarball via `.gitattributes`.
- **Dev-only / gitignored**: `CLAUDE.md` (maintainer's local
  Claude Code rules), `.claude/` (dev rules / skills / agents),
  most of `docs/` (research log, decisions, harness engineering,
  etc.). Tracked exceptions: `docs/document-corruption.md`,
  `docs/threat-model.md`, `docs/security-policy.md`,
  `docs/getting-started.md` / `.ja.md`,
  `docs/opus-4-7-playbook.md`.

## Distribution boundary — flag violations

- Files under `agents/`, `skills/`, `hooks/`, `.claude-plugin/`,
  `README*.md`, `LICENSE`, `PRIVACY.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` are SHIPPED to plugin
  users. They MUST be **English**. Japanese intent notes go in
  `<!-- HTML comments -->` only.
- Files under `.claude/`, `CLAUDE.md`, gitignored `docs/*` are
  dev-only — Japanese is fine.
- A PR that adds Japanese to a shipped artifact is a bug. Flag it.
- A PR that adds a new tracked file under `docs/` without
  whitelisting it in `.gitignore` is also a bug — the file would
  be silently dropped from the next clone. Flag it.

## Bash conventions (hooks/, scripts/)

- `bash` 4.0+ baseline; portable across `bash` and `zsh`. Compatible
  with **BSD awk** (macOS) and **GNU awk** (Linux). Notably
  `match($0, /.../, arr)` is gawk-only and forbidden; use 1-arg form
  - manual extraction.
- `set -u` only. **`set -e` is intentionally not used** — the project
  prefers explicit error handling per call site over implicit
  termination. Don't suggest adding `set -euo pipefail` globally.
- All hook / lib functions use the `mumei_` (or `_mumei_` for private)
  prefix. `scripts/lint-bash-prefix.sh` enforces this.
- `jq` calls must be null-safe. Prefer `// empty` and `?` to coerce
  missing fields into empty rather than literal `"null"`. The
  recently-merged `task pr:watch` / `main:watch` lessons are baked
  into `Taskfile.yml`.
- Quoting matters. `shellcheck` runs on every hook; `shellharden`
  runs in CI as `lint-extra`.
- Hook handlers MUST honour `MUMEI_BYPASS=1` (escape hatch for
  the user) — exit early with `exit 0` before any gate logic.
- `${CLAUDE_PLUGIN_ROOT:-}` MUST always have the `:-` fallback,
  because `pre-commit` and CI both set it to empty in some paths.

## What review SHOULD focus on

1. **Distribution-boundary violations** (above).
2. **Bash safety**: unquoted variables, `[[ ]]` vs `[ ]` consistency,
   pipefail behaviour, BSD vs GNU tool divergence, quoting around
   command substitutions, error code propagation across pipes.
3. **Hook semantics**: correctness of state transitions in
   `hooks/_lib/state.sh`, `_lib/tasks.sh`, `_lib/review.sh`. Hook
   IDs are documented in `ARCHITECTURE.md` (Hook rules table) and
   referenced in code via `# H-NN` markers — `scripts/lint-hook-ids.sh`
   enforces consistency. Flag any drift.
4. **Plugin manifest** (`.claude-plugin/plugin.json`): SemVer
   discipline, schema validity, no dev-only refs leaked.
5. **Schema-driven types**: `schemas/*.json` is the source of truth;
   `dashboard/src/types/*.ts` is generated. PRs that hand-edit the
   generated TS without updating the schema break drift checks.
6. **Doc-sync**: code changes that affect external behaviour MUST
   accompany the doc update in the same commit (`scripts/lint-docs-drift.sh`
   covers a subset). Flag mismatches between `ARCHITECTURE.md` /
   `README.md` / `agents/<n>.md` count and the actual filesystem.
7. **CI workflow integrity**: every `uses:` in `.github/workflows/`
   MUST be SHA-pinned (`actions/checkout@<40-hex>` form, with a
   trailing `# vN.N.N` comment). `pr.yml` `mutable-tag-guard` job
   enforces this. Flag any `@v2` / `@main` reference.
8. **Concurrency / failure modes / silent errors**: this is the
   `agents/adversarial-reviewer.md` axis. Cross-feature impact,
   race conditions in atomic-write sequences, MCP server timeout
   handling, etc. Surface what other reviewers might miss.

## What review should NOT do

- **Do not propose rewriting bash to Python or Rust.** The bash +
  jq stack is a deliberate distribution-footprint choice; this
  trade-off is documented in `docs/mumei-decisions.md` (gitignored
  but visible to maintainer). Suggesting a rewrite is out of scope
  and will be filtered.
- **Do not suggest adding `set -e` / `set -euo pipefail` globally.**
  Project policy chose explicit error handling. See
  `.claude/rules/bash-conventions.md` (gitignored) and the
  `set -u`-only convention in `hooks/_lib/log.sh`.
- **Do not suggest premature abstractions for one-off code.** mumei's
  KISS rule: three repetitions before extraction. Single-use helpers
  are fine.
- **Do not suggest forward-compatibility shims** (renamed `_var` placeholders,
  `// removed` comment trails, feature flags running old + new in
  parallel). The project prefers direct rewrites.
- **Do not flag missing newlines / trailing whitespace / Markdown
  list style** — `pre-commit` (prettier, markdownlint-cli2,
  end-of-file-fixer, trim-trailing-whitespace) handles those.
  Surface those only when they cause functional issues.
- **Do not flag missing `.PHONY` / `Makefile` items** — the project
  uses Taskfile, not Make.
- **Do not propose splitting workflow files for the sake of it.**
  `ci.yml` is intentionally consolidated to share an event listener
  and matrix.

## Severity rubric (calibration)

- **HIGH** — silently breaks user-facing behaviour, leaks a secret,
  bypasses a security gate, breaks the distribution tarball, or
  inverts a documented invariant.
- **MEDIUM** — degrades observability, introduces silent drift,
  weakens an existing check, or contradicts shipped documentation.
- **LOW** — style polish, minor clarity, suggestion-grade.
- **NIT** — rarely useful; prefer to omit and let pre-commit handle.

If you cannot articulate a concrete failure scenario, do not raise
the finding. Hypothetical concerns without a chain to user impact
are filtered out at validator time per the same rule
`agents/issue-validator.md` applies.

## Useful pointers

- `ARCHITECTURE.md` — runtime structure, Hook rules table, agent
  list, distribution matrix.
- `CONTRIBUTING.md` — local dev setup, Task runner, PR workflow,
  release procedure.
- `docs/threat-model.md` — security boundary, defence-in-depth
  layers (gitleaks 3 stages, trufflehog, semgrep, CodeQL,
  Scorecards, Sigstore + SLSA).
- `Taskfile.yml` — single-source-of-truth entry points
  (`task lint` / `test` / `validate` / `ci:replay` /
  `release:check` / `pr:copilot`).
