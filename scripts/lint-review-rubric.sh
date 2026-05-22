#!/usr/bin/env bash
# lint-review-rubric.sh — enforce byte-parity of the universal review rubric
# block (REQ-24) across its three carriers. The block lives between
# `<!-- BEGIN universal-review-rubric -->` and `<!-- END universal-review-rubric -->`.
# Canonical source is .github/review-rubric.md; AGENTS.md and .gemini/styleguide.md
# must embed an identical block so Codex / Gemini / the Claude review workflow
# share one viewpoint. set -u, no set -e (explicit handling).
set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root" || {
  echo "lint-review-rubric: cannot cd to repo root" >&2
  exit 1
}

files=(
  ".github/review-rubric.md"
  "AGENTS.md"
  ".gemini/styleguide.md"
)

begin='<!-- BEGIN universal-review-rubric -->'
end='<!-- END universal-review-rubric -->'

# Extract the lines strictly between the markers (BSD-awk compatible).
_mumei_extract_block() {
  awk -v b="$begin" -v e="$end" '
    index($0, b) { f = 1; next }
    index($0, e) { f = 0 }
    f' "$1"
}

ref=""
ref_file=""
status=0
for f in "${files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "lint-review-rubric: missing carrier $f" >&2
    status=1
    continue
  fi
  block="$(_mumei_extract_block "$f")"
  if [[ -z "$block" ]]; then
    echo "lint-review-rubric: no universal-review-rubric block found in $f" >&2
    status=1
    continue
  fi
  if [[ -z "$ref" ]]; then
    ref="$block"
    ref_file="$f"
  elif [[ "$block" != "$ref" ]]; then
    echo "lint-review-rubric: block in $f differs from $ref_file" >&2
    diff <(printf '%s\n' "$ref") <(printf '%s\n' "$block") >&2 || true
    status=1
  fi
done

if [[ "$status" -eq 0 ]]; then
  echo "lint-review-rubric: ${#files[@]} carriers in sync"
fi
exit "$status"
