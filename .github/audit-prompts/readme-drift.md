# README ↔ CLAUDE.md Drift Audit

Detect inconsistencies across the three documentation surfaces:

- `README.md` (user-facing, English)
- `CLAUDE.md` (developer-facing, Japanese)
- `docs/mumei-decisions.md` (canonical design log, Japanese)

…and against the actual implementation under `hooks/`, `skills/`, `agents/`,
and `.claude-plugin/plugin.json`.

## Step 1 — Build a feature map from each source

Read each doc and the implementation, then build an internal map:

- Phase model (4 phases: plan → implement → review → done)
- Wave structure inside `tasks.md`
- Hook list (events × scripts)
- Skill list (with namespaces — `/mumei:plan`, `/mumei:init`, etc.)
- Agent list (reviewers, validator)
- Escape hatch (`MUMEI_BYPASS=1`)
- `.mumei/` directory layout

For each item, record:

- present in README? yes/no
- present in CLAUDE.md? yes/no
- present in decisions.md? yes/no
- present in implementation? yes/no

## Step 2 — Detect drift

Drift categories:

- **HIGH** — README claims something the implementation does not provide
  (broken promise to users)
- **HIGH** — README is missing a feature that user can actually use (hidden
  capability)
- **MEDIUM** — CLAUDE.md or decisions.md is out of sync with implementation
  (developer confusion)
- **MEDIUM** — README and CLAUDE.md disagree on a fact a user might check
- **LOW** — doc-only typo or broken link

## Step 3 — Apply false-positive guards

Do NOT flag:

- README is more concise than CLAUDE.md (by design — README is for users,
  CLAUDE.md is the dev guide)
- bash conventions, research discipline, etc. that exist only in CLAUDE.md
  by design (these are dev-only)
- decisions.md "history" / "revision log" sections (those are append-only
  and should not be reflected in README)
- HTML comments (`<!-- ... -->`) — by mumei convention these are dev memos
  and intentionally excluded from rendering

## Step 4 — Decide whether to file an issue

Find prior open issues with label `doc-drift`:

    gh issue list --label doc-drift --state open --json number,body --limit 3

- 0 findings AND no open issue: print "No drift" and exit 0.
- 0 findings AND an open issue exists: comment "Drift cleared on YYYY-MM-DD".
- ≥ 1 findings AND no open issue: create a new one (Step 5 format).
- ≥ 1 findings AND an open issue exists: compare new vs existing; comment
  with the delta.

## Step 5 — Issue format

Title: `[doc-drift] YYYY-MM-DD: <count> inconsistencies`

Body:

    Last checked: YYYY-MM-DD

    ## Findings

    ### [HIGH] <one-line title>
    - **README.md**: line N — "<quote>"
    - **CLAUDE.md**: line N — "<quote>"
    - **decisions.md**: line N — "<quote>"
    - **Implementation**: <file:line or 'not found'>
    - **Drift**: <which one is wrong; what to update>

    ### [MEDIUM] ...

Apply label `doc-drift`.

## What NOT to do

- Do not modify any docs in this run.
- Do not propose harmonizing length / style across English and Japanese.
- Do not flag "differences in tone" — the languages have different audiences.
- Do not invent drift; cite both file:line locations for every finding.
