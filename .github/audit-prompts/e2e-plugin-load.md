# mumei Plugin E2E Test

End-to-end verification that the mumei plugin distribution is internally
consistent. The repo checkout IS the plugin (this workflow runs in the
repository root).

Note on scope: user-invoked skills (`/mumei:init`, `/mumei:plan`, etc.)
cannot be triggered programmatically in headless mode (per
https://code.claude.com/docs/en/headless). So this E2E exercises the plugin
along three orthogonal dimensions that catch the most common breakage:

1. Manifest + artifact resolution (everything declared exists)
2. Hook script discipline (all `hooks/*.sh` follow mumei's bash conventions)
3. Documented `.mumei/` layout matches `docs/mumei-decisions.md` Part 13

## Scenario 1 — Plugin load

Read `.claude-plugin/plugin.json`. For each declared field, validate per the
plugin manifest schema. If `commands`, `skills`, or `agents` are declared
explicitly (rather than auto-discovered), flag — mumei convention is to omit
these and rely on auto-discovery.

Then for each artifact directory:

- For every `agents/*.md`: parse frontmatter, verify required fields
  (`name`, `description`, `model`), verify forbidden fields are absent
  (`hooks`, `mcpServers`, `permissionMode`)
- For every `skills/*/SKILL.md`: parse frontmatter, verify `description`
- For every `hooks/*.sh`: file exists and is executable (or `chmod +x`-able)

If any check fails, record the file path and the failure.

## Scenario 2 — Hook script discipline

Read each `hooks/*.sh` and `hooks/_lib/*.sh`. For each, verify:

- `set -u` is set somewhere in the file (greppable)
- `${CLAUDE_PLUGIN_ROOT:-}` is used (with `:-` fallback) if the file
  references the plugin root
- `MUMEI_BYPASS=1` early-exit pattern present in entry-point hooks (the
  files referenced from `hooks/hooks.json`, not the `_lib/` helpers)
- Functions are named `mumei_*` or `_mumei_*`

If any check fails, record the file path and the failure.

## Scenario 3 — `.mumei/` layout vs decisions.md

Read `docs/mumei-decisions.md` Part 13 (or the relevant `.mumei/` layout
section). Extract the documented structure (e.g., `current`, `specs/<feature>/`,
`archive/<YYYY-MM>/`).

Then read `skills/init/SKILL.md` (or wherever the init skill defines the
layout it creates). Verify the documented layout matches what the skill
would create.

If they drift, record:

- What decisions.md says
- What skills/init produces
- The drift line

## Output

If ALL scenarios pass:

    gh pr comment "${PR_NUMBER}" --body \
      "## E2E ✓ — all 3 scenarios passed (audited N artifacts)."

If ANY scenario fails:

    gh pr comment "${PR_NUMBER}" --body-file <path>

Body shape:

    ## E2E ✗ — <N> failure(s)

    ### Scenario 1 — Plugin load
    <pass / fail with details>

    ### Scenario 2 — Hook script discipline
    <pass / fail with details>

    ### Scenario 3 — .mumei/ layout vs decisions.md
    <pass / fail with details>

Then exit 1 (CI fail).

## What NOT to do

- Do not invoke user-facing skills programmatically; the docs say they
  cannot run in headless mode.
- Do not write any files during the test (read-only).
- Do not exit early on the first failure — collect all and report once.
- Do not exit 0 if any scenario failed.
