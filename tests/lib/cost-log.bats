#!/usr/bin/env bats
# Tests for hooks/_lib/cost-log.sh — REQ-11.5 cost-log helpers.

bats_require_minimum_version 1.5.0

load '../test_helper'

setup() {
  MUMEI_TEST_TMPDIR="$(mktemp -d -t mumei-test.XXXXXX)"
  export MUMEI_TEST_TMPDIR
  cd "$MUMEI_TEST_TMPDIR" || return 1
  # shellcheck disable=SC1091
  source "$CLAUDE_PLUGIN_ROOT/hooks/_lib/cost-log.sh"
}

@test "mumei_cost_log_path returns the per-feature path" {
  run mumei_cost_log_path "REQ-1-foo"
  [ "$status" -eq 0 ]
  [ "$output" = ".mumei/specs/REQ-1-foo/cost-log.jsonl" ]
}

@test "mumei_cost_log_before creates the file and writes one JSONL line" {
  mumei_cost_log_before "REQ-1-foo" 1 2 "spec-compliance-reviewer"
  [ -f ".mumei/specs/REQ-1-foo/cost-log.jsonl" ]
  lines="$(wc -l <".mumei/specs/REQ-1-foo/cost-log.jsonl")"
  [ "$lines" -eq 1 ]
  rec="$(cat .mumei/specs/REQ-1-foo/cost-log.jsonl)"
  [ "$(jq -r '.phase' <<<"$rec")" = "before" ]
  [ "$(jq -r '.feature' <<<"$rec")" = "REQ-1-foo" ]
  [ "$(jq -r '.wave' <<<"$rec")" = "1" ]
  [ "$(jq -r '.iteration' <<<"$rec")" = "2" ]
  [ "$(jq -r '.agent' <<<"$rec")" = "spec-compliance-reviewer" ]
}

@test "mumei_cost_log_after appends usage fields" {
  mumei_cost_log_after "REQ-1-foo" 1 2 "spec-compliance-reviewer" \
    '{"input_tokens":100,"output_tokens":50,"cache_read_input_tokens":1000,"cache_creation_input_tokens":200}'
  rec="$(cat .mumei/specs/REQ-1-foo/cost-log.jsonl)"
  [ "$(jq -r '.phase' <<<"$rec")" = "after" ]
  [ "$(jq -r '.input_tokens' <<<"$rec")" = "100" ]
  [ "$(jq -r '.output_tokens' <<<"$rec")" = "50" ]
  [ "$(jq -r '.cache_read_input_tokens' <<<"$rec")" = "1000" ]
  [ "$(jq -r '.cache_creation_input_tokens' <<<"$rec")" = "200" ]
}

@test "before + after produce 2 lines, one per phase" {
  mumei_cost_log_before "REQ-1-foo" 1 1 "security-reviewer"
  mumei_cost_log_after "REQ-1-foo" 1 1 "security-reviewer" \
    '{"input_tokens":1,"output_tokens":1,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}'
  lines="$(wc -l <".mumei/specs/REQ-1-foo/cost-log.jsonl")"
  [ "$lines" -eq 2 ]
}

@test "missing usage fields default to 0" {
  mumei_cost_log_after "REQ-1-foo" 1 1 "memory-curator" '{}'
  rec="$(cat .mumei/specs/REQ-1-foo/cost-log.jsonl)"
  [ "$(jq -r '.input_tokens' <<<"$rec")" = "0" ]
  [ "$(jq -r '.output_tokens' <<<"$rec")" = "0" ]
}

@test "garbage usage_json falls back to {} (no crash, all zeros)" {
  mumei_cost_log_after "REQ-1-foo" 1 1 "memory-curator" 'not-valid-json'
  rec="$(cat .mumei/specs/REQ-1-foo/cost-log.jsonl)"
  [ "$(jq -r '.input_tokens' <<<"$rec")" = "0" ]
  [ "$(jq -r '.phase' <<<"$rec")" = "after" ]
}

@test "JSONL: every line parses as a valid JSON object" {
  mumei_cost_log_before "REQ-1-foo" 1 1 "a"
  mumei_cost_log_after "REQ-1-foo" 1 1 "a" '{"input_tokens":1}'
  mumei_cost_log_before "REQ-1-foo" 1 1 "b"
  mumei_cost_log_after "REQ-1-foo" 1 1 "b" '{"input_tokens":2}'
  while IFS= read -r line; do
    echo "$line" | jq -e 'type == "object"' >/dev/null
  done <".mumei/specs/REQ-1-foo/cost-log.jsonl"
}
