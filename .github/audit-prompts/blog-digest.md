# Anthropic Engineering Blog Digest

Detect new Anthropic engineering articles and propose how mumei should
absorb them.

## Step 1 — Determine baseline

Read prior issues with label `blog-digest`:

    gh issue list --label blog-digest --state all --limit 3 \
      --json body,createdAt

If a prior issue exists, extract the `Last checked: YYYY-MM-DD` line. That
date is your baseline.

If no prior issue, baseline = today minus 30 days.

Also read `docs/harness-engineering.md` Part 5 — it lists 21 already-summarized
articles. These are the existing baseline you must NOT duplicate.

## Step 2 — Fetch the engineering page

Use `curl` (the WebFetch tool is unreliable in CI — its internal summarizer
tries a discontinued model and 404s):

    mkdir -p /tmp/spec
    curl -sSLf -o /tmp/spec/engineering.html https://www.anthropic.com/engineering

Read with the Read tool. Parse the article list — each article has a title
and a date (e.g., "Apr 08, 2026").

If curl fails or the page format has changed (no parseable article list),
abort: print the error and exit 0. Do NOT create an issue from stale data.

**Run curl exactly once per URL.** Once a file exists in `/tmp/spec/`,
re-read it with the Read tool — do NOT re-run curl in later turns.

## Step 3 — Identify new articles

A new article is one whose:

- Date is after the baseline date, AND
- Title does not appear in `docs/harness-engineering.md` Part 5

## Step 4 — For each new article

Fetch with curl (same pattern as Step 2):

    curl -sSLf -o /tmp/spec/article-N.html <article URL>

Read with the Read tool. Summarize in 3–5 sentences. Then evaluate:

- **Relevance to mumei**: HIGH (changes a design assumption) / MEDIUM
  (introduces a technique mumei could adopt) / LOW (general interest only) /
  NONE
- **Conflict check**: does the article contradict a decision in
  `docs/mumei-decisions.md`? If yes, flag specifically (cite Part #).
- **Concrete proposal**: what would mumei do with this? File-level instruction.

## Step 5 — Decide to issue or not

- 0 new articles → print "No new articles since YYYY-MM-DD" and exit 0.
- ≥ 1 new articles:
  - Find existing open `blog-digest` issue. If exists, comment.
  - Else create a new one.

## Step 6 — Issue format

Title: `[blog-digest] YYYY-MM-DD: <N> new article(s)`

Body:

    Last checked: YYYY-MM-DD

    ## New articles

    ### 1. <Title>
    - **Date**: <date>
    - **URL**: <url>
    - **Summary**: <3–5 sentences>
    - **Relevance to mumei**: HIGH / MEDIUM / LOW / NONE
    - **Conflict with decisions.md**: <Part # if any, else 'none'>
    - **Proposal**: <concrete; "no action recommended" is a valid output>

    ### 2. ...

Apply label `blog-digest`. If at least one article warrants an addition to
`docs/harness-engineering.md`, also apply `harness-engineering`.

## What NOT to do

- Do not modify `docs/harness-engineering.md` in this run. The reflection is
  for the human to do (or a follow-up task).
- Do not include articles already in Part 5.
- Do not speculate; cite the article URL for every claim.
- Do not pad the issue with low-relevance articles. If LOW or NONE for all,
  still file the issue but mark each as such — the human can close quickly.
