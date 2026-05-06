# mumei Distribution Audit — Weekly Mode

Full scan of the mumei plugin distribution against the **latest official
Claude Code specifications**. Run weekly to catch drift caused by upstream
spec changes (mumei did not change, but the spec did).

## Scope

All files under:

- `hooks/`
- `skills/`
- `agents/`
- `.claude-plugin/`

## Step 1 — Fetch latest specs

Always fetch fresh:

- `https://code.claude.com/docs/en/hooks`
- `https://code.claude.com/docs/en/skills`
- `https://code.claude.com/docs/en/sub-agents`
- `https://code.claude.com/docs/en/plugins-reference`
- `https://code.claude.com/docs/en/changelog` (look for breaking changes)

If a fetch fails, abort: do NOT create an issue based on stale knowledge.
Print the failure and exit 0.

## Step 2 — Audit every distribution file

For each file, apply the rules in
`.github/audit-prompts/distribution-audit-pr.md` (Step 3).

## Step 3 — Decide whether to file an issue

Find prior open issues with label `audit-weekly`:

    gh issue list --label audit-weekly --state open --json number,title,body --limit 5

Behavior:

- **No findings AND no open issue**: print "No drift detected" and exit 0.
  Do not create an issue.
- **No findings AND an open issue exists**: comment on the open issue with
  "Drift cleared on YYYY-MM-DD — please close if confirmed".
- **Findings AND no open issue**: create a new issue (Step 4 format) with
  label `audit-weekly`.
- **Findings AND an open issue exists**: compare the new findings against
  the existing issue body. If identical, do nothing. If new findings are
  present, comment on the issue with the delta.

## Step 4 — Issue format

Title: `[audit-weekly] YYYY-MM-DD: <count> finding(s) (CRITICAL: x, HIGH: y)`

Body:

    Last checked: YYYY-MM-DD
    Spec snapshot:
      - hooks doc: <fetched URL or 'failed'>
      - skills doc: ...
      - sub-agents doc: ...
      - plugins-reference doc: ...

    ## Findings

    ### [CRITICAL] <one-line title>
    - **File**: path:line
    - **Rule**: <which spec rule, with URL>
    - **Current**: <quote of the code>
    - **Expected**: <what the spec wants>
    - **Suggested fix**: <patch or instruction>

    ### [HIGH] ...

Add label `audit-weekly`.

## What NOT to do

- Do not modify any code in this run.
- Do not file an issue if all findings are already in an existing open issue.
- Do not include speculation; cite the doc URL for every claim.
- Do not propose breaking changes (renaming a public skill / agent) without
  marking them as `requires-human-decision`.
