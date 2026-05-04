---
name: archive
description: Moves a completed feature directory from .mumei/specs/<feature>/ to .mumei/archive/<YYYY-MM>/<feature>/ once the feature reaches phase=done. Triggers when the user explicitly archives a feature or when /mumei:plan finishes the review phase with verdict=PASS and the user confirms.
disable-model-invocation: true
allowed-tools: [Read, Write, Bash, Glob]
argument-hint: <feature>
---

<!--
Role: Move a completed feature into archive/{YYYY-MM}/
Input: feature slug
Output: mv .mumei/specs/<feature>/ -> .mumei/archive/<YYYY-MM>/<feature>/
Principle: Side-effect heavy, so disable-model-invocation: true (user-invoked only)
-->

# Archive

Move a completed feature out of the active workspace into the archive directory. This skill is **user-invocable only** (`disable-model-invocation: true`) — Claude will not auto-trigger archiving even if the workflow seems "done".

## When to use

- The user explicitly invokes `/mumei:archive <feature>`.
- A feature has `phase: done` and the user is ready to clean up the active workspace.

## Pre-flight checks

Refuse with a clear error if any of these fail:

1. `<feature>` slug must exist as a directory under `.mumei/specs/`.
2. `state.json` must have `phase: "done"` (or `phase: "review"` with the latest review verdict `PASS`, with explicit confirmation).
3. Working tree must be clean for files within the feature's `_Files:_` scope. Uncommitted changes in those files = refuse.
4. `<feature>` must NOT be the active feature in `.mumei/current`. If it is, ask the user to clear `.mumei/current` first or pick another feature to archive.

## Method

```bash
source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/state.sh"

feature="$1"
[[ -d ".mumei/specs/${feature}" ]] || { echo "Feature not found: ${feature}" >&2; exit 1; }

phase="$(mumei_state_phase "$feature" 2>/dev/null || true)"
if [[ "$phase" != "done" ]]; then
  echo "Feature ${feature} is not done (phase=${phase}). Refuse." >&2
  exit 1
fi

# Calculate archive subdir based on creation month (or current month if missing)
created_at="$(mumei_state_get "$feature" '.created_at' 2>/dev/null)"
yyyymm="$(date -u -d "${created_at}" +%Y-%m 2>/dev/null || date -u +%Y-%m)"

target_dir=".mumei/archive/${yyyymm}"
mkdir -p "$target_dir"

# Refuse if target already exists (collision)
if [[ -e "${target_dir}/${feature}" ]]; then
  echo "Archive target already exists: ${target_dir}/${feature}" >&2
  exit 1
fi

# Move (the directory move + git history serves as the audit trail)
git mv ".mumei/specs/${feature}" "${target_dir}/${feature}" 2>/dev/null \
  || mv ".mumei/specs/${feature}" "${target_dir}/${feature}"

# Move the brainstorm scratch file alongside the spec, if present.
# init/SKILL.md tracks .mumei/scratch/ as "the source of design decisions";
# leaving it behind after archive splits the audit trail. No-op when the
# feature was created without /mumei:brainstorm (e.g. direct /mumei:plan
# invocation). The destination filename is fixed to scratch.md because the
# parent directory already encodes the feature slug.
slug="$(mumei_state_get "$feature" '.slug' 2>/dev/null || true)"
scratch_src=".mumei/scratch/${slug}.md"
if [[ -n "$slug" && -f "$scratch_src" ]]; then
  scratch_dst="${target_dir}/${feature}/scratch.md"
  git mv "$scratch_src" "$scratch_dst" 2>/dev/null \
    || mv "$scratch_src" "$scratch_dst"
fi
```

## After archiving

Tell the user:

> Archived `<feature>` to `.mumei/archive/<YYYY-MM>/<feature>/`. Commit the move:
> 
> ```
> git add -A && git commit -m "archive: move <feature> to <YYYY-MM>"
> ```

## Don'ts

- Don't archive a feature that is not `phase: done`. Refuse with a clear message.
- Don't archive the active feature. Ask the user to switch first.
- Don't overwrite an existing archive directory. Refuse with a clear message.
- Don't auto-commit the move — let the user commit it themselves to keep audit trail clean.
- Don't modify the feature's content during the move. Only `state.json` gets `archived_at` added.
