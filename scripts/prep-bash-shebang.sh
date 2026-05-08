#!/usr/bin/env bash
# Pre-commit prep step for shell / bats files: chmod +x any file with a
# shebang and shfmt -w it. Runs BEFORE check-shebang-scripts-are-executable
# and shfmt -d so those checks pass on the first commit attempt for
# newly-authored files. Returns 0 even when it modifies files; the
# subsequent shfmt -d hook will fail-and-restage if the format pass is
# still wrong, but in practice the auto-write below is sufficient.
#
# Args: file paths (passed by pre-commit's `types: [shell]` filter).

set -u

for file in "$@"; do
  [[ -f "$file" ]] || continue

  # Only act on files that begin with a shebang. Skips data files that
  # the `types: [shell]` matcher might pull in by accident.
  if ! head -c2 "$file" 2>/dev/null | grep -q '^#!'; then
    continue
  fi

  if [[ ! -x "$file" ]]; then
    chmod +x "$file"
    printf 'prep-bash-shebang: chmod +x %s\n' "$file" >&2
  fi

  # shfmt -w is conservative: matches the project's existing 2-space
  # indent + case-indent convention. Skips bats files where shfmt's
  # bash parser can over-aggressively rewrite the test DSL.
  case "$file" in
  *.bats) ;; # bats DSL is parsed differently from plain bash — skip
  *)
    if command -v shfmt >/dev/null 2>&1; then
      # Match the project's pre-commit shfmt args (`-i 2`, no -ci).
      shfmt -i 2 -w "$file" 2>/dev/null || true
    fi
    ;;
  esac
done

# Always exit 0 — pre-commit will detect any modifications and fail the
# commit on its own modified-files check, prompting the user to re-stage.
# That extra commit step is the inherent cost of pre-commit's design;
# this hook just removes the manual `chmod +x` / `shfmt -w` step that
# would otherwise be needed.
exit 0
