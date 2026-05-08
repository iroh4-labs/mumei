#!/usr/bin/env bats
# Tests for hooks/_lib/log-rotate.sh — REQ-14 Wave 1.

bats_require_minimum_version 1.5.0

load '../test_helper'

setup() {
  MUMEI_TEST_TMPDIR="$(mktemp -d -t mumei-test.XXXXXX)"
  export MUMEI_TEST_TMPDIR
  cd "$MUMEI_TEST_TMPDIR" || return 1
  unset MUMEI_BYPASS MUMEI_LOG_MAX_MB
  # shellcheck disable=SC1091
  source "$CLAUDE_PLUGIN_ROOT/hooks/_lib/log-rotate.sh"
}

# Build a JSONL file of N lines under .mumei/audit-log/test.jsonl.
# Each line is a small valid JSON object with a sequence number so we
# can verify which records survived a truncate.
_make_jsonl() {
  local count="$1"
  local target="${2:-.mumei/audit-log/test.jsonl}"
  mkdir -p "$(dirname "$target")"
  : >"$target"
  local i
  for ((i = 1; i <= count; i++)); do
    printf '{"seq":%d}\n' "$i" >>"$target"
  done
}

# Pad a JSONL file to roughly N MB by appending bulky filler records
# (one per line). Used to push files past size thresholds without
# generating tens of thousands of structurally-tiny records.
_pad_jsonl_to_mb() {
  local target="$1" target_mb="$2"
  mkdir -p "$(dirname "$target")"
  local filler
  filler="$(printf '%.0sX' {1..400})"
  local target_bytes=$((target_mb * 1024 * 1024))
  local cur
  cur="$(wc -c <"$target" 2>/dev/null | tr -d ' ')"
  cur="${cur:-0}"
  local i=0
  while ((cur < target_bytes)); do
    i=$((i + 1))
    printf '{"pad":%d,"x":"%s"}\n' "$i" "$filler" >>"$target"
    cur=$((cur + 421))
  done
}

@test "kuroko gate: returns 0 silently when .mumei/ is absent" {
  rm -rf .mumei
  run mumei_log_rotate_check_and_truncate ".mumei/.hook-stats.jsonl"
  [ "$status" -eq 0 ]
  [ ! -d .mumei ]
}

@test "below threshold: file under MAX_MB triggers no truncate" {
  mkdir -p .mumei
  _make_jsonl 100 ".mumei/.hook-stats.jsonl"
  local before_lines
  before_lines="$(wc -l <.mumei/.hook-stats.jsonl | tr -d ' ')"
  run mumei_log_rotate_check_and_truncate ".mumei/.hook-stats.jsonl"
  [ "$status" -eq 0 ]
  local after_lines
  after_lines="$(wc -l <.mumei/.hook-stats.jsonl | tr -d ' ')"
  [ "$after_lines" -eq "$before_lines" ]
}

@test "over threshold: truncates to latest 5000 lines, keeps tail records" {
  mkdir -p .mumei
  _make_jsonl 8000 ".mumei/.hook-stats.jsonl"
  _pad_jsonl_to_mb ".mumei/.hook-stats.jsonl" 11
  run mumei_log_rotate_check_and_truncate ".mumei/.hook-stats.jsonl"
  [ "$status" -eq 0 ]
  local after_lines
  after_lines="$(wc -l <.mumei/.hook-stats.jsonl | tr -d ' ')"
  [ "$after_lines" -eq 5000 ]
  # The very last line (a pad record) must still be present — the
  # surviving slice is the tail, not the head.
  local last_line
  last_line="$(tail -n 1 .mumei/.hook-stats.jsonl)"
  echo "$last_line" | jq -e '.pad' >/dev/null
}

@test "MUMEI_BYPASS=1: skips rotation even when over threshold" {
  mkdir -p .mumei
  _make_jsonl 8000 ".mumei/.hook-stats.jsonl"
  _pad_jsonl_to_mb ".mumei/.hook-stats.jsonl" 11
  local before_lines
  before_lines="$(wc -l <.mumei/.hook-stats.jsonl | tr -d ' ')"
  MUMEI_BYPASS=1 run mumei_log_rotate_check_and_truncate ".mumei/.hook-stats.jsonl"
  [ "$status" -eq 0 ]
  local after_lines
  after_lines="$(wc -l <.mumei/.hook-stats.jsonl | tr -d ' ')"
  [ "$after_lines" -eq "$before_lines" ]
}

@test "MUMEI_LOG_MAX_MB override fires rotation at a smaller bound" {
  mkdir -p .mumei
  _make_jsonl 6000 ".mumei/.hook-stats.jsonl"
  # Pad to ~2 MB so the default 10 MB bound is well below trigger,
  # but a 1 MB override fires.
  _pad_jsonl_to_mb ".mumei/.hook-stats.jsonl" 2
  MUMEI_LOG_MAX_MB=1 run mumei_log_rotate_check_and_truncate ".mumei/.hook-stats.jsonl"
  [ "$status" -eq 0 ]
  local after_lines
  after_lines="$(wc -l <.mumei/.hook-stats.jsonl | tr -d ' ')"
  [ "$after_lines" -eq 5000 ]
}

@test "atomic rename: file remains valid JSONL after rotation" {
  mkdir -p .mumei/audit-log
  _make_jsonl 7000 ".mumei/audit-log/test.jsonl"
  _pad_jsonl_to_mb ".mumei/audit-log/test.jsonl" 11
  run mumei_log_rotate_check_and_truncate ".mumei/audit-log/test.jsonl"
  [ "$status" -eq 0 ]
  # Every surviving line must be valid JSON: a partial mid-line cut
  # would leave a malformed record that jq -e fails on.
  while IFS= read -r line; do
    echo "$line" | jq -e 'type == "object"' >/dev/null
  done <.mumei/audit-log/test.jsonl
}

@test "absent target file: returns 0 without creating anything" {
  mkdir -p .mumei
  run mumei_log_rotate_check_and_truncate ".mumei/audit-log/never-existed.jsonl"
  [ "$status" -eq 0 ]
  [ ! -f .mumei/audit-log/never-existed.jsonl ]
}

@test "informational stderr is emitted when rotation fires" {
  mkdir -p .mumei
  _make_jsonl 6000 ".mumei/.hook-stats.jsonl"
  _pad_jsonl_to_mb ".mumei/.hook-stats.jsonl" 11
  run mumei_log_rotate_check_and_truncate ".mumei/.hook-stats.jsonl"
  [ "$status" -eq 0 ]
  [[ "$output" == *"auto-cleanup"* ]] || [[ "$stderr" == *"auto-cleanup"* ]]
}
