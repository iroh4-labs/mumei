# Claude Code Update Digest

Weekly digest of Claude Code platform updates with concrete proposals for
how mumei should adapt. Output is a GitHub issue.

## Step 1 — Determine baseline

Read prior issues with label `claude-code-update`:

    gh issue list --label claude-code-update --state all --limit 5 \
      --json number,body,createdAt

If a prior issue exists, extract the `Last checked: YYYY-MM-DD` line from
the most recent body. That date is your baseline.

If no prior issue exists, use today minus 14 days as baseline.

## Step 2 — Fetch update sources

Always fetch fresh:

- `https://code.claude.com/docs/en/changelog` — version-by-version notes
- `https://code.claude.com/docs/llms.txt` — full doc index, useful for
  discovering pages that have been added since baseline
- `https://code.claude.com/docs/en/hooks` — current hook spec (full event list)
- `https://code.claude.com/docs/en/skills` — current skill frontmatter
- `https://code.claude.com/docs/en/sub-agents` — current agent frontmatter
- `https://code.claude.com/docs/en/plugins-reference` — manifest spec
- `https://code.claude.com/docs/en/headless` — programmatic / SDK changes
- `https://platform.claude.com/docs/en/about-claude/models/overview` — current
  model IDs and which ones are deprecated

## Step 3 — Diff against mumei

Read the mumei codebase to ground every proposal:

- `hooks/hooks.json` — what hook events / matchers / handlers mumei uses
- `agents/*.md` — what frontmatter fields and tools are in use
- `skills/**/SKILL.md` — same
- `.claude-plugin/plugin.json` — manifest fields
- `docs/mumei-decisions.md` — what mumei has explicitly decided NOT to do
- `docs/harness-engineering.md` — what background research is already filed

## Step 4 — Identify actionable updates

Flag only changes that are actionable for mumei. Examples of actionable:

- A new hook event mumei could use
- A new skill / agent frontmatter field that simplifies mumei's setup
- A deprecated API still used in mumei
- A new `claude --bare` / SDK feature that improves CI workflows
- A new model id mumei should adopt
- A change to plugin manifest schema

### Step 4a — Pinned model ID staleness check

mumei pins certain model IDs as full versions (not aliases) where alias
auto-update doesn't reach — typically env vars consumed by background tools.
For each pinned ID, verify it's still the recommended current version on the
models overview page fetched in Step 2. If a newer version supersedes it,
propose updating the pin.

Files to grep for full model IDs:

- `.github/workflows/*.yml` — look for `model:` keys and `claude_env:` blocks
  that set `ANTHROPIC_DEFAULT_*_MODEL` / `ANTHROPIC_MODEL` to a full ID
  (matching `claude-(opus|sonnet|haiku)-[0-9]`)
- `agents/*.md` and `skills/**/SKILL.md` frontmatter `model:` — only flag if
  the value is a full ID (e.g., `claude-haiku-4-5-20251001`); aliases
  (`sonnet` / `opus` / `haiku`) auto-resolve and are NOT stale by definition

For each stale pin, report:

- File:line
- Currently pinned: `<old ID>`
- Latest available: `<new ID>` (with link to models overview entry)
- Reason for the pin (env var that demands full ID, third-party provider, etc.)
- Proposed change (the exact replacement string)

This is `Severity: MEDIUM` if the pinned ID is still supported, `Severity:
HIGH` if it has been deprecated or removed (the API would 404).

Examples of NOT actionable (do not propose):

- New tutorial or how-to pages
- Cosmetic doc rewrites
- Features for IDE integrations mumei does not target
- Alias-based `model:` frontmatter (those auto-update by design)

## Step 5 — Decide to issue or not

- 0 actionable updates → print "No actionable updates since YYYY-MM-DD" and
  exit 0. Do not create an issue.
- ≥ 1 actionable updates → check for an existing open issue with label
  `claude-code-update`:
  - exists → comment on it with the new findings (do not duplicate)
  - none → create a new issue

## Step 6 — Issue format

Title: `[claude-code-update] YYYY-MM-DD: <one-line summary>`

Body:

    Last checked: YYYY-MM-DD
    Sources fetched:
      - <url 1>
      - <url 2>
      ...

    ## Summary

    <2-3 sentences>

    ## Actionable proposals

    ### 1. <change>
    - **Source**: <doc URL with anchor>
    - **Quote from source**: "<exact text>"
    - **Current state in mumei**: <file:line reference> or "not present"
    - **Proposed change**: <concrete, file-level instruction>
    - **Severity**: HIGH / MEDIUM / LOW
    - **Effort**: trivial / small / medium / large

    ### 2. <change>
    ...

Apply label `claude-code-update`.

## What NOT to do

- Do not modify any code in this run.
- Do not include claims that you have not verified against the source URL.
- Do not file an issue for cosmetic / non-actionable updates.
- Do not duplicate proposals already filed in a prior open issue.
- Do not invent severities — anchor them to concrete impact (breaks
  something / improves something / nice-to-have).
