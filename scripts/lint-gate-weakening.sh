#!/usr/bin/env bash
# Detect a diff that makes the build green by weakening the checks instead of
# fixing the code. Deterministic and narrow: only signatures whose whole purpose
# is to suppress a gate, plus the deletion of a gate's own files.
#
# Usage: bash scripts/lint-gate-weakening.sh [base_ref]   (default: origin/main)
#
# Response model: a hit is NOT a bug report to be argued away, and this script
# accepts no in-band justification — a comment saying "intentional" changes
# nothing. A hit means the change belongs in front of a human who is not its
# author. That escalation is the reviewer's, not this script's: it reports and
# exits 1.
#
# Deliberately NOT here: weakened assertions / deleted test cases inside a file.
# Grep cannot tell a loosened matcher from a legitimately relaxed one, and the
# false-positive arms race would train everyone to ignore the output. The wall
# for that class is the clean-HEAD worktree re-measurement (I3), which reruns
# the tests as HEAD defines them.
#
# Also NOT here: `# shellcheck disable=`. This repo's own conventions require it
# per-line for dynamic `source` paths (SC1091), so it fires on correct code. A
# detector that cries on the house style is a detector everyone learns to skip.

set -u

base="${1:-origin/main}"
if ! git rev-parse --verify --quiet "$base" >/dev/null; then
  base="main"
  git rev-parse --verify --quiet "$base" >/dev/null || {
    printf 'no base ref to diff against (tried origin/main, main)\n' >&2
    exit 1
  }
fi

merge_base="$(git merge-base "$base" HEAD 2>/dev/null || true)"
if [[ -z "$merge_base" ]]; then
  printf 'no merge-base with %s\n' "$base" >&2
  exit 1
fi

findings=""

# 1. Added lines that suppress a gate. Anchored on '+' (additions only) and
#    excluding the +++ header. Each pattern is a construct whose only function
#    is to stop a check from failing.
#
#    This script and its bats file are excluded from THIS scan: the signature
#    table below and the fixtures that exercise it are made of the very strings
#    being matched, so a detector that scanned them would flag every edit to
#    itself, and a check that is always red is a check nobody reads. They are
#    NOT excluded from the deleted-files scan (2) — removing the detector is
#    exactly the move worth catching.
while IFS= read -r hit; do
  [[ -n "$hit" ]] && findings+="$hit"$'\n'
done < <(
  git diff --unified=0 "${merge_base}...HEAD" -- . \
    ':!scripts/lint-gate-weakening.sh' \
    ':!tests/scripts/lint-gate-weakening.bats' |
    awk '
      /^\+\+\+ / { file = substr($0, 7); next }
      /^\+/ {
        line = substr($0, 2)
        if (line ~ /continue-on-error:[[:space:]]*true/) print file ": continue-on-error: true — a failing step stops failing the job"
        else if (line ~ /--no-verify/) print file ": --no-verify — skips the pre-commit / pre-push hooks"
        else if (line ~ /if:[[:space:]]*false/) print file ": if: false — disables a job/step in place"
        else if (line ~ /--exit-zero/) print file ": --exit-zero — the scanner reports findings but returns success"
        else if (line ~ /eslint-disable/) print file ": eslint-disable — lint suppression"
        else if (line ~ /@ts-(ignore|expect-error)/) print file ": @ts-ignore / @ts-expect-error — type-check suppression"
        else if (line ~ /#[[:space:]]*type:[[:space:]]*ignore/) print file ": # type: ignore — type-check suppression"
        else if (line ~ /#[[:space:]]*noqa/) print file ": # noqa — lint suppression"
      }
    ' | sort -u
)

# 2. Deleted gate files. A test file or a workflow that no longer exists cannot
#    fail. Renames are not deletions — --diff-filter=D with -M excludes them.
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  case "$f" in
  tests/*) findings+="${f}: a test file was deleted"$'\n' ;;
  .github/workflows/*) findings+="${f}: a workflow was deleted"$'\n' ;;
  scripts/lint-*) findings+="${f}: a lint was deleted"$'\n' ;;
  .pre-commit-config.yaml) findings+="${f}: the pre-commit config was deleted"$'\n' ;;
  esac
done < <(git diff -M --diff-filter=D --name-only "${merge_base}...HEAD" -- . 2>/dev/null)

if [[ -n "$findings" ]]; then
  printf 'gate-weakening signatures in this diff (vs %s):\n\n' "$base" >&2
  printf '%s' "$findings" >&2
  printf '\nThis check does not accept a justification written by the author of the diff.\nIf the weakening is correct, a human who did not write it approves the PR.\n' >&2
  exit 1
fi

printf 'gate-weakening: none (vs %s)\n' "$base"
exit 0
