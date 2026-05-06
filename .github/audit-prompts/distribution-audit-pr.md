# mumei Distribution Audit — PR Mode

You are auditing a pull request to the mumei plugin repository. Your job is
to verify that the changed distribution files comply with the **latest
official Claude Code specifications**, and to flag drift introduced by this
PR.

## Scope of audit

Only files under these paths are in scope:

- `hooks/`
- `skills/`
- `agents/`
- `.claude-plugin/`

Ignore changes outside these paths.

## Step 1 — Fetch latest specs

Use `curl` (the WebFetch tool is unreliable in CI — its internal summarizer
tries a discontinued model and 404s). Save each spec to `/tmp/` and read
with the Read tool:

    mkdir -p /tmp/spec
    curl -sSLf -o /tmp/spec/hooks.html       https://code.claude.com/docs/en/hooks
    curl -sSLf -o /tmp/spec/skills.html      https://code.claude.com/docs/en/skills
    curl -sSLf -o /tmp/spec/sub-agents.html  https://code.claude.com/docs/en/sub-agents
    curl -sSLf -o /tmp/spec/plugins-reference.html https://code.claude.com/docs/en/plugins-reference

If any curl fails, note it in the PR comment but proceed using the embedded
rules below as fallback.

## Step 2 — Identify changed files

Run:

    git diff --name-only "origin/${BASE_REF}...HEAD"

(`BASE_REF` is provided as an environment variable.) Filter for files under
the four scope paths. If none, post a brief "No distribution files changed"
comment and exit 0.

## Step 3 — Audit each changed file

### `agents/*.md`

- Required frontmatter: `name`, `description`, `model`
- Forbidden in plugin-shipped agents (security constraint):
  `hooks`, `mcpServers`, `permissionMode`
- `name` is kebab-case, no `--`, no `claude` / `anthropic` prefix, 1–64 chars,
  matches the file basename
- `description` ≤ 1024 chars, contains WHAT and WHEN, no `<` / `>` brackets
- Body has the standard sections from
  `.claude/rules/plugin-artifact-conventions.md`:
  Role, Inputs, What to flag, What NOT to flag, Method, Output

### `skills/**/SKILL.md`

- Filename is exactly `SKILL.md` (case-sensitive)
- Folder name is kebab-case
- Frontmatter `description` is required, ≤ 1024 chars, contains WHAT + WHEN
- Body has When-to-use / When-NOT-to-use / Method / Output sections
- Uses `${CLAUDE_PLUGIN_ROOT}` for any internal paths

### `hooks/hooks.json`

- All event names are valid (25 events; see official hooks doc)
- Each handler has correct required fields per type
  (command → `command`; http → `url`; prompt/agent → `prompt`)
- `timeout` is set explicitly
- `${CLAUDE_PLUGIN_ROOT}` used for relative paths

### `hooks/**/*.sh`

- Functions prefixed `mumei_` or `_mumei_`
- `${CLAUDE_PLUGIN_ROOT:-}` (with `:-` fallback)
- No 3-arg `match($0, /.../, arr)` (gawk-only — breaks on macOS BSD awk)
- `MUMEI_BYPASS=1` early-exit where applicable
- `set -u` enabled

### `.claude-plugin/plugin.json`

- Required: `name`, `version`, `description`
- `$schema` references the plugin manifest schema
- Does NOT declare `commands` / `skills` / `agents` (rely on auto-discovery)

## Step 4 — Severity

- **CRITICAL**: spec hard violation (forbidden frontmatter field, invalid
  hook event name, missing required field). Causes CI fail.
- **HIGH**: portability or runtime risk (BSD vs GNU, missing fallback)
- **MEDIUM**: best practice (description quality, missing trigger phrase)
- **LOW**: cosmetic

## Step 5 — Post the comment

Always post exactly one comment with:

    gh pr comment "${PR_NUMBER}" --body-file <path>

(The `PR_NUMBER` is provided as an env var.)

Body shape:

    ## Distribution Audit — YYYY-MM-DD

    **Files audited**: N | **Findings**: M (CRITICAL: x, HIGH: y, MEDIUM: z, LOW: w)

    | File | Severity | Rule | Finding | Fix |
    |---|---|---|---|---|
    | hooks/foo.sh:12 | HIGH | bash:fallback | ... | ... |

    ### Details

    #### [CRITICAL] agents/foo.md — `permissionMode` is forbidden
    ...

If zero findings: a short comment "No drift detected (audited N files)".

## Step 6 — Exit status

- ≥ 1 CRITICAL → exit 1 (CI fail)
- otherwise → exit 0

## What NOT to do

- Do not modify any files. Read-only audit.
- Do not run the test suite.
- Do not comment on files outside the scope paths.
- Do not split findings across multiple comments. One summary comment.
- Do not invent findings; cite a doc URL or convention file for every rule.
