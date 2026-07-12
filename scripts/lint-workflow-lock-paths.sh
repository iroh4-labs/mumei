#!/usr/bin/env bash
# Verify every dependency lock a workflow references actually exists in the repo.
#
# review-reusable.yml branches on whether the semgrep lock is present: absent
# means an adopter has not vendored it, so semgrep is skipped and reported as
# `unknown` rather than as zero findings. That is right for adopters and wrong
# here — in THIS repository an absent lock does not mean "not vendored", it
# means a path was mistyped, and the mistyped path takes the same soft arm: the
# detector is silently skipped and CI stays green (#197). The `-r <path>` install
# sites fail loudly (pip exits 1 on a missing file); the lock-existence check does
# not. This lint closes that gap at commit time, before the typo can reach CI.
#
# The failure it guards against is not hypothetical: #194 moved the locks out of
# `.github/` (Dependabot refuses to write there, #191) and rewrote four lock paths
# by hand.
#
# The check runs in BOTH directions, and it has to. Forwards: every lock a workflow
# names must be a tracked file. Backwards: every lock tracked under .github-deps/
# must be named by some workflow. The forward check alone leaves the matcher's own
# vocabulary unguarded — rename a lock and it simply stops being seen, quietly,
# because the other locks keep the match set non-empty. Any matcher hardcodes
# something, so widening the regex only relocates the blind spot; the backward check
# anchors on the DIRECTORY instead of the filename, and that is what terminates it.
#
# Matching is otherwise syntax-agnostic: it collects paths from non-comment lines of
# any workflow rather than keying off `-r` or `semgrep_lock=`, so a reference written
# some other way tomorrow is covered for free.
#
# set -u, no set -e (explicit handling).
set -u

# Resolve the root of the repository we are STANDING IN, not the one this script
# was copied from. Deriving it from ${BASH_SOURCE[0]} would pin the lint to the
# mumei checkout it lives in, and a lint whose failure path cannot be exercised
# against a fixture is exactly the untested fail-closed branch #197 is about.
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$repo_root" ]]; then
  echo "lint-workflow-lock-paths: not a git repository" >&2
  exit 1
fi
cd "$repo_root" || {
  echo "lint-workflow-lock-paths: cannot cd to ${repo_root}" >&2
  exit 1
}

# Both extensions: GitHub Actions honours .yml AND .yaml, so scanning only .yml
# would let a lock reference in a .yaml workflow escape unchecked — and because
# the .yml files keep the match set non-empty, the gone-blind guard below would
# not fire either. That is this lint's own bug, reopened at the file extension.
# `find` rather than a glob: an unmatched `*.yaml` glob expands to the literal
# string and would be grepped as a filename.
workflows=()
while IFS= read -r f; do
  [[ -n "$f" ]] && workflows+=("$f")
done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null)

# Non-comment lines only: a comment naming a path is prose, not a reference.
# The path must have at least one directory segment — review-reusable.yml's Claude
# prompt says "pip `requirements.txt` with hashes" as English, and a bare filename
# is not a path. One segment is enough (`deps/requirements.txt`); requiring two
# would skip a shallower lock in silence.
paths=""
if ((${#workflows[@]} > 0)); then
  paths="$(grep -hvE '^[[:space:]]*#' "${workflows[@]}" 2>/dev/null |
    grep -oE '[.a-zA-Z0-9_-]+(/[.a-zA-Z0-9_-]+)*/requirements\.txt' |
    sort -u)"
fi

# A lint that finds nothing to check must fail, not pass. If the workflows stop
# matching (renamed lock file, restructured install step), silence here would
# read as "all locks present" while checking zero of them — the same
# absent-reads-as-clean bug this lint exists to catch.
if [[ -z "$paths" ]]; then
  echo "lint-workflow-lock-paths: no lock path found in .github/workflows/" >&2
  echo "  the workflows reference locks; matching zero of them means this lint has gone blind." >&2
  echo "  fix the matcher rather than deleting the check." >&2
  exit 1
fi

# `git ls-files`, not `[[ -f ]]`: an untracked file exists locally and is absent
# in CI's fresh checkout, which is exactly the state that would ship a dead
# detector while passing on the author's machine.
missing=()
while IFS= read -r p; do
  git ls-files --error-unmatch "$p" >/dev/null 2>&1 || missing+=("$p")
done <<<"$paths"

if ((${#missing[@]} > 0)); then
  echo "lint-workflow-lock-paths: workflow references a lock that is not a tracked file:" >&2
  for p in "${missing[@]}"; do
    echo "  ${p}" >&2
  done
  echo "  a missing semgrep lock is reported as 'not run', not as a failure, so this" >&2
  echo "  would disable the detector with CI still green. Fix the path or track the file." >&2
  exit 1
fi

# The other direction: every lock we ship must be referenced by a workflow.
#
# Checking only "referenced => exists" leaves the matcher's own vocabulary
# unguarded. Rename one lock to constraints.txt and update its workflow, and the
# matcher — which keys off the name `requirements.txt` — simply stops seeing it:
# the reference count drops from 3 to 2, the remaining two still match so the
# gone-blind guard stays quiet, and a typo in the renamed path sails through.
#
# Any matcher hardcodes SOMETHING, so this cannot be solved by widening the regex
# again; it just moves the blind spot. It is solved by changing what the check is
# anchored to. Here the anchor is the DIRECTORY, not the filename: a lock that sits
# in .github-deps/ and is referenced by nothing is either dead weight or a file the
# matcher can no longer see — and both deserve a failure.
#
# Excluded from "is a lock": `.in` (pip-compile inputs, never installed) and `.md`
# (a README explaining why this directory is not under `.github/` is a thing someone
# will reasonably add — schemas/README.md is the precedent — and it must not read as
# an unreferenced lock). This excludes NON-locks by extension rather than enumerating
# what a lock is called, which is what keeps the rename hole shut: a lock is never
# renamed to `.md`.
orphans=()
while IFS= read -r lock; do
  [[ -z "$lock" ]] && continue
  printf '%s\n' "$paths" | grep -qxF "$lock" || orphans+=("$lock")
done < <(git ls-files '.github-deps/*' | grep -vE '\.(in|md)$')

if ((${#orphans[@]} > 0)); then
  echo "lint-workflow-lock-paths: lock is tracked but no workflow references it:" >&2
  for lock in "${orphans[@]}"; do
    echo "  ${lock}" >&2
  done
  echo "  either it is dead weight, or this lint can no longer see the reference" >&2
  echo "  (a renamed lock file leaves the matcher looking for a name nobody uses)." >&2
  exit 1
fi

count="$(printf '%s\n' "$paths" | wc -l | tr -d ' ')"
echo "lint-workflow-lock-paths: ${count} workflow-referenced locks are tracked files"
exit 0
