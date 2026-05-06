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

Use `curl` (the WebFetch tool is unreliable in CI — its internal summarizer
tries a discontinued model and 404s). Save each source to `/tmp/` and read
with the Read tool:

    mkdir -p /tmp/spec
    curl -sSLf -o /tmp/spec/changelog.html         https://code.claude.com/docs/en/changelog
    curl -sSLf -o /tmp/spec/llms.txt               https://code.claude.com/docs/llms.txt
    curl -sSLf -o /tmp/spec/hooks.html             https://code.claude.com/docs/en/hooks
    curl -sSLf -o /tmp/spec/skills.html            https://code.claude.com/docs/en/skills
    curl -sSLf -o /tmp/spec/sub-agents.html        https://code.claude.com/docs/en/sub-agents
    curl -sSLf -o /tmp/spec/plugins-reference.html https://code.claude.com/docs/en/plugins-reference
    curl -sSLf -o /tmp/spec/headless.html          https://code.claude.com/docs/en/headless
    curl -sSLf -o /tmp/spec/models-overview.html   https://platform.claude.com/docs/en/about-claude/models/overview

`-sSLf` = silent + show errors + follow redirects + fail-on-HTTP-error.

If any curl fails, abort: do NOT create an issue based on stale knowledge.
Print the failure and exit 0.

**Run curl exactly once per URL.** Once a file exists in `/tmp/spec/`,
re-read it with the Read tool — do NOT re-run curl in later turns.

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

Examples of NOT actionable (do not propose):

- New tutorial or how-to pages
- Cosmetic doc rewrites
- Features for IDE integrations mumei does not target
- Model version bumps in general — mumei uses `sonnet` / `opus` aliases that
  auto-resolve to the recommended current version on each call. Only flag a
  model change if a model is being **deprecated/removed** (the alias would
  break) or if a fundamentally new model class is introduced.

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
