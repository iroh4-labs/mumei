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
# Matching is deliberately syntax-agnostic: it collects every `<dir>/requirements.txt`
# appearing on a non-comment line of any workflow, rather than keying off `-r` or
# `semgrep_lock=`. A future reference written some other way is covered for free —
# a lint that only recognises today's spelling degrades to silence, which is the
# very failure this file exists to prevent.
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
  echo "lint-workflow-lock-paths: no lock path found in .github/workflows/*.yml" >&2
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

count="$(printf '%s\n' "$paths" | wc -l | tr -d ' ')"
echo "lint-workflow-lock-paths: ${count} workflow-referenced locks are tracked files"
exit 0
