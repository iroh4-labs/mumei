# Changelog

All notable changes to **mumei** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7] - 2026-05-04

### Added

- **Deterministic detector integration in the review pipeline (REQ-2).** `/mumei:plan` now runs three detectors as Stage 0 before any LLM reviewer launches: `semgrep --config=auto` (SAST / OWASP Top 10), `osv-scanner` (CVE / dependency vulnerabilities, supports the standard nine lockfiles), and a bash-only `hallucinated-package-check` against the npm registry. Findings are normalised to HIGH / MEDIUM / LOW (`ERROR`/`WARNING`/`INFO` for semgrep, CVSS thresholds for osv-scanner, missing/unknown for hpc) and persisted to `.mumei/specs/<feature>/reviews/<ts>-detectors.json`. HIGH findings are injected as ground truth into the four reviewer prompts via `<detector_findings ground_truth="true">`; HIGH > 0 also skips `security-reviewer` (deterministic detectors are ground truth for that category) and pins the verdict to `MAJOR_ISSUES`. The new `hooks/pre-review-detector.sh` is the skill-led entry point — Hook event integration was rejected after research showed `SubagentStart` is not blockable and per-subagent dispatch would require complex two-layer coupling.
- **Detector binary requirements.** `semgrep` (≥1.50.0) and `osv-scanner` (≥1.7.0) are now hard prerequisites; missing binaries cause `pre-review-detector.sh` to exit 2 with `brew install` guidance. `MUMEI_BYPASS=1` is the only escape (powers all four guards: pre-bash, pre-edit, post-edit, stop). `/mumei:init` now warns on missing binaries without blocking; the hard fail happens at review time. README and README.ja both grew a `Prerequisites` section with macOS/Linux install commands and a CI snippet (GitHub Actions).
- **Stop-hook detector defense line.** `hooks/stop-guard.sh` now requires every review JSON in `.mumei/specs/<feature>/reviews/` to point to a readable detector report via the top-level `detector_report` field; missing pointer, missing file, malformed/empty/whitespace-only review JSON each surface a distinct block reason. The lookup is decoupled from review-vs-detector filename timestamps (the orchestrator and detector script use independent ISO formats); reading the field instead of reconstructing a path eliminates the basename-coupling failure mode.
- **`issue-validator` skip rule for detector findings.** Findings whose `source` is `semgrep`, `osv-scanner`, `hallucinated-package-check`, or contains `detector` are echoed back as `decision: valid` without analysis — LLM validation of deterministic ground-truth wastes tokens and risks downgrading a true positive.
- **`Detector findings (ground truth)` section in all four reviewer agents** (`spec-compliance`, `code-quality`, `security`, `adversarial`). Reviewers must not validate, dispute, or downgrade entries inside the injected block, must not duplicate them in `findings`, and should reference them in `summary` only when contextually relevant.
- **`.claude/skills/self-evaluate` rubric criterion 2.6 + anchor extraction** for detector integration so the dogfood evaluation loop can score whether the feature was wired in correctly (lib presence, hook script presence, run-function count = 3, skill HIGH-branch language, stop-guard detector check, agent ground-truth sections, bats coverage).

### Changed

- **`Stop` hook output schema corrected.** `hooks/stop-guard.sh` no longer emits `hookSpecificOutput.hookEventName: "Stop"` — that shape is rejected by the official Claude Code Stop-hook validator (`hookSpecificOutput` is defined only for `PreToolUse` / `UserPromptSubmit` / `PostToolUse` / `PostToolBatch`). All four block sites in stop-guard now use the top-level `systemMessage` field for the long-form context, with `reason` carrying the headline. Bats tests already pass on `decision`/`reason` only and were unaffected; this bug was not caught by the review pipeline because nothing in mumei validates hook outputs against the official JSON schema (REQ-3 candidate).
- **`pre-review-detector.sh` exit contract is now defensive-in-depth.** Stdout summary carries `detectors_ran`, `high_count`, `report_path`, `failed_detectors`, and (for the bypass branch) `bypassed: true`. The script exits 0 only on a clean run; any detector that crashed (binary rc ≥ 2) lands in `failed_detectors` and the script exits 2. SIGINT and SIGTERM emit a stub JSON with `interrupted: true` and a `signal` field before exiting 2 — orchestrators no longer see empty stdout on Ctrl-C. User-side errors (no lockfile, no `package.json`, malformed `package.json`) are recorded in `detectors_skipped`, not `failed_detectors`; the review pipeline does not hard-block on a developer's package.json typo.
- **`/mumei:plan` Stage 0 contract documents the new behaviour.** The skill now explicitly tells the orchestrator to capture both stdout and `rc`, branch on `bypassed: true` first (ahead of the clean-run invariant), then `rc == 2` (STOP), then the clean-run case (`rc == 0` AND `detectors_ran == true` AND `failed_detectors == []`). REQ-2.14 surfacing is documented inline: when `high_count > 0`, the orchestrator must prepend `.findings.HIGH` from the detector report into `findings_surfaced` before persisting the review JSON.

### Internal

- **`_init_feature` test helper centralised in `tests/test_helper.bash`.** Four bats files (`pre-bash-guard`, `pre-edit-guard`, `stop-guard`, `pre-review-detector`) had near-duplicate state.json scaffolding; the common shape now lives in the helper, with each suite keeping only its bespoke `tasks.md` generation as a thin local wrapper.
- **bats coverage for the new code paths.** New tests cover detector lib unit behaviour (severity normaliser boundaries, OSV/HPC skip paths, aggregator HIGH/MEDIUM/LOW classification — `tests/lib/detectors.bats`, 21 cases), the pre-review-detector hook (bypass / missing binary / no current feature / happy / detector crash / malformed package.json skip — `tests/hooks/pre-review-detector.bats`, 9 cases), the stop-guard defense line (decoupled-timestamp / missing detector_report / malformed-or-empty review JSON — `tests/hooks/stop-guard.bats` grew from 13 to 18 cases), and a Wave-3 dogfood structural check (`tests/integration/wave3-dogfood.bats`, 10 cases). Total bats grew from 47 to 159.
- **Three review-pipeline iterations + one informal verification, all archived.** REQ-2 went through `/mumei:plan` review iteration 1 (5 valid findings, MAJOR_ISSUES), iteration 2 (6 valid findings, MAJOR_ISSUES — including the iter-1 fix's own SKILL.md drift), and iteration 3 (4 valid findings, NEEDS_IMPROVEMENT — including iter-2 fix's own `jq empty` 0-byte gap). The override fix commit and a final adversarial-only safety pass converged the loop. The recurring "fix introduces a new edge" pattern reflects an absence of synchronised docs/code/test linting in mumei's harness — REQ-3 candidate.

## [0.1.6] - 2026-05-03

### Added

- **`$schema` declaration in `.claude-plugin/marketplace.json`** pointing at `https://json.schemastore.org/claude-code-marketplace.json` so editors can autocomplete and validate the marketplace manifest. Claude Code itself ignores the field at load time per the official plugin marketplace spec; this is purely an editor-facing aid. The schemastore URL is the catalog-registered schema and matches the convention already used for `plugin.json` and `hooks.json` in this repo.

### Changed

- **Distribution language boundary tightened.** Japanese maintainer comments in shipped artifacts (`agents/*.md`, `skills/*/SKILL.md`, `hooks/*.sh`, `hooks/_lib/*.sh`) are now in English. Plugin distributions had Japanese prose inside HTML comments, bash comments, and a Japanese-body example in `skills/plan/SKILL.md`; the language boundary contract calls for distributed files to be English-only. The Japanese-body example in `/mumei:plan` is replaced by a one-line note instructing the model to mirror the English template structure with the user's language for the prose around English EARS keywords. README's `日本語版 README` link and the `(無名)` etymology in the Philosophy section are kept — they are user-facing references to the project's name origin, not maintainer notes.

### Internal

- Self-evaluation rubric run produced a 3.62 / 4.00 baseline (`.claude/skills/self-evaluate/results/2026-05-03.md`, gitignored). The two changes above were the top two improvement items the rubric surfaced (`1.5_schemas` G→E, `1.2_jp_chars_in_dist` P→E for the distribution-only count).

## [0.1.5] - 2026-05-03

### Added

- **`/mumei:init` now generates `.mumei/.gitignore`** so team-shared spec content (`requirements.md` / `design.md` / `tasks.md` / `coverage-check.json` / `reviews/*.json` / `scratch/` / `archive/`) is tracked by git, while per-developer state (`.mumei/current` cursor and `specs/*/state.json` progress) is ignored. Existing `.mumei/.gitignore` files are NOT overwritten.

### Changed

- **`/mumei:init` no longer adds `.mumei/scratch/` to the project-root `.gitignore`.** Brainstorm history is the source of design decisions and is now intentionally tracked. Existing projects whose root `.gitignore` already lists `.mumei/scratch/` are not auto-migrated; remove the line manually if you want scratch tracked.
- **CI bats install switched from `bats-core/bats-action@3.0.0` to direct `git clone + install.sh`.** The action pulled in `actions/cache@v4` (Node 20 deprecation warning) and surfaced four "Failed to restore: tar exit code 2" warnings per bats job in v0.1.4 due to cache corruption. The shallow `git clone --depth 1 --branch v1.11.0` + `sudo /tmp/bats-core/install.sh /usr/local` runs in a few seconds on both `ubuntu-latest` and `macos-latest`, removes the Node-20 warning, removes the tar-restore warnings, and keeps the bats version pinned.

## [0.1.4] - 2026-05-03

### Changed

- **`actions/checkout@v4` → `@v6`** in `.github/workflows/ci.yml` to silence the GitHub Actions Node.js 20 deprecation warning. Node 24 support was introduced in `actions/checkout@v5.0.0`; v6 ships incremental improvements on top. Forced Node 24 default starts 2026-06-02 and Node 20 is removed from runners on 2026-09-16, so this is preemptive. The `actions/cache@v4` warning surfaced on the bats job is a transitive dependency of `bats-core/bats-action@3.0.0` and remains until that upstream bumps.

## [0.1.3] - 2026-05-03

### Fixed

- **Orchestrator → archive handoff was silently skipped on `phase=done`.** When `/mumei:plan` reached `verdict=PASS` and advanced the feature to `phase=done`, the orchestrator was not consistently prompting the user to run `/mumei:archive`. The Stop hook now physically enforces the handoff: if a feature is `phase=done` and still listed as active in `.mumei/current`, session exit is blocked with a message prompting `/mumei:archive <feature>` (or `.mumei/current` clearing). Documented as Hook rule **R3** in `docs/mumei-decisions.md` Part 10.3.
- **`skills/plan/SKILL.md`** Phase 5 verdict-PASS branch now explicitly documents the archive-handoff steps so future orchestrator runs do not depend on the model remembering.

### Added

- **bats unit test suite for hook logic** under `tests/` (112 tests covering `hooks/_lib/{log,state,tasks}.sh` + all 5 `hooks/*.sh` entry-point scripts + plugin manifest / frontmatter checks). Local run: `bats -r tests/`.
- **CI matrix job** (`.github/workflows/ci.yml`) runs the bats suite on `ubuntu-latest` and `macos-latest` to catch BSD/GNU and jq version drift. Uses `bats-core/bats-action@3.0.0` with `bats-version: 1.11.0` pinned.

### Internal

- The test-suite feature itself (`REQ-1-test-suite`) was the first end-to-end dogfood of the mumei workflow: brainstorm → plan → 8 implementation Waves → 2 review iterations (4 reviewers + per-issue validators) → done → archive. Spec and review history archived under `.mumei/archive/2026-05/REQ-1-test-suite/` of the development repo (gitignored, not distributed).

## [0.1.2] - 2026-05-03

### Added

- **Language conventions** for spec documents. The `/mumei:plan`, `/mumei:brainstorm`, and `/mumei:refine` skills now explicitly follow a hybrid policy:
  - Section headings (`## User Story`, `## Acceptance Criteria`, `## Out of Scope`, etc.) stay in **English** so hooks and parsers can read them reliably.
  - Body content (User Story prose, AC clauses, Assumptions, Open Questions, design narratives, task descriptions) follows the **user's conversation language** — Japanese users get Japanese prose, English users get English.
  - EARS keywords (`WHEN`/`WHILE`/`IF`/`WHERE`/`SHALL`), inline annotations (`[CONFIRMED]`/`[ASSUMPTION]`/`[NEEDS CLARIFICATION]`), trace IDs (`REQ-N.M`), and task meta (`_Files:_`/`_Depends:_`/`_Requirements:_`) stay in **English** regardless.
- **`README.ja.md`** — Japanese-language README mirroring the English `README.md`. Linked from the top of `README.md`.

### Changed

- **README.md `Status` line** updated from `v0.1.0` to `v0.1.2` to match the released version.

## [0.1.1] - 2026-05-03

### Added

- **Self-hosted marketplace** — `.claude-plugin/marketplace.json` so users can install via `/plugin marketplace add hir4ta/mumei` + `/plugin install mumei@mumei`.

### Changed

- **README install instructions** rewritten around the marketplace flow. The legacy `claude --plugin-dir` path is documented as a development-only option.
- **Description** now leads with "A Claude Code harness" to surface the harness-engineering positioning. `harness` and `harness-engineering` added to `keywords`.
- **Manifest cleanup**: `email` field removed from `author` / `owner` blocks in both `plugin.json` and `marketplace.json` (privacy).

## [0.1.0] - 2026-05-03

Initial release. Pre-1.0; expect breaking changes between minor versions.

### Added

- **Plugin scaffold** — `.claude-plugin/plugin.json`, `README.md`, `LICENSE` (MIT), `.github/workflows/ci.yml`.
- **5 reviewer subagents** that run independently with fresh context per review:
  - `spec-compliance-reviewer` (Sonnet) — implementation vs `requirements.md` / `tasks.md`.
  - `code-quality-reviewer` (Sonnet) — design smells, KISS / DRY / SOLID, missing tests.
  - `security-reviewer` (Opus) — OWASP Top 10 with sink-based detection.
  - `adversarial-reviewer` (Opus) — production failure scenarios; receives prior reviewers' findings to avoid duplication.
  - `issue-validator` (Sonnet, parallel-spawned per finding) — re-validates each finding for accuracy / groundedness / actionability.
- **2 coverage agents** for `/mumei:plan`'s Coverage Check stage:
  - `coverage-extractor` — extracts requirements stated in conversation.
  - `coverage-validator` — diffs extracted requirements against the generated `requirements.md` to detect gaps and hallucinations.
- **6 user-facing skills** with `mumei:` namespace:
  - `/mumei:plan` — orchestrator for the full feature lifecycle (requirements → design → tasks → implement → review).
  - `/mumei:brainstorm` — structured pre-spec brainstorming (max 5 questions × 3 rounds).
  - `/mumei:refine` — targeted refinement of a specific spec section.
  - `/mumei:init` — one-time per-project setup; proposes `CLAUDE.md` additions with diff preview.
  - `/mumei:archive` — moves completed features to `.mumei/archive/<YYYY-MM>/` (`disable-model-invocation: true`).
  - Internal `state` skill (user-invocable: false) — wraps `state.json` CRUD for other skills.
- **Hook-enforced quality gates** (`hooks/hooks.json` + 5 bash handlers):
  - PreToolUse: deny edits in `plan` phase outside the spec, deny commits with failing tests or incomplete Waves, deny pushes with `MAJOR_ISSUES` review verdict.
  - PostToolUse: detect phantom completion (marking `[x]` without an implementation diff), warn on out-of-scope Bash modifications.
  - Stop: block session end when all tasks are done but the review pipeline has not run.
- **`hooks/_lib/`** shared shell library (`state.sh` / `tasks.sh` / `log.sh`) for atomic `state.json` writes and BSD-awk-compatible `tasks.md` parsing.
- **Single bypass mechanism**: `MUMEI_BYPASS=1` environment variable disables all gates.
- **Spec format** — User Story + EARS-form acceptance criteria + `[CONFIRMED]` / `[ASSUMPTION]` / `[NEEDS CLARIFICATION]` inline annotations. No frontmatter, no row caps, single-series `REQ-N.M` traceability IDs.

### Out of scope (intentional)

- Marketplace publication is pending. v0.1 is local-install only via `claude --plugin-dir`.
- No SDD-tool adapters (spec-kit / spec-workflow / tsumiki / cc-sdd). mumei runs in its own mode.
- No MCP servers. State is plain files; no semantic search, no DB.
- No Cursor / Codex / other-IDE support. Hooks are Claude-Code-specific.
- No bats unit tests yet (planned for v0.2). CI runs shellcheck + JSON validation + frontmatter checks.
