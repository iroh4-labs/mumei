#!/usr/bin/env bats
# Tests for hooks/_lib/detectors-ext.sh — Tier1 extension detectors
# (secret-scan / type-check / test-check). Collectors are exercised with
# synthetic tool outputs so no real binary is required.

bats_require_minimum_version 1.5.0

load '../test_helper'

setup() {
  MUMEI_TEST_TMPDIR="$(mktemp -d -t mumei-test.XXXXXX)"
  export MUMEI_TEST_TMPDIR
  cd "$MUMEI_TEST_TMPDIR" || return 1
  # shellcheck disable=SC1091
  source "$CLAUDE_PLUGIN_ROOT/hooks/_lib/detectors.sh"
  # shellcheck disable=SC1091
  source "$CLAUDE_PLUGIN_ROOT/hooks/_lib/detectors-ext.sh"
}

teardown() {
  [ -n "${MUMEI_TEST_TMPDIR:-}" ] && rm -rf "$MUMEI_TEST_TMPDIR"
}

# ─── registration + metadata ──────────────────────────────────

@test "ext detectors register into the pluggable registry" {
  [[ " ${MUMEI_DETECTOR_REGISTRY} " == *" secret-scan "* ]]
  [[ " ${MUMEI_DETECTOR_REGISTRY} " == *" type-check "* ]]
  [[ " ${MUMEI_DETECTOR_REGISTRY} " == *" test-check "* ]]
}

@test "ext detectors are tier 1, ground_truth" {
  [ "$(mumei_detector_meta secret-scan)" = "1 ground_truth" ]
  [ "$(mumei_detector_tier type-check)" = "1" ]
  [ "$(mumei_detector_class test-check)" = "ground_truth" ]
}

# ─── secret-scan collect ──────────────────────────────────────

@test "secret-scan collect: gitleaks finding -> HIGH ground_truth" {
  printf '%s' '{"tool":"gitleaks","rc":0,"raw":[{"RuleID":"aws-key","File":"src/cfg.ts","StartLine":12,"Description":"AWS key"}]}' >out.json
  printf '[]' >finds.json
  _mumei_det_secret_scan_collect out.json finds.json
  run jq -r '.[0].severity' finds.json
  [ "$output" = "HIGH" ]
  run jq -r '.[0].precision_class' finds.json
  [ "$output" = "ground_truth" ]
  run jq -r '.[0].location.file' finds.json
  [ "$output" = "src/cfg.ts" ]
  run jq -r '.[0].rule_id' finds.json
  [ "$output" = "aws-key" ]
}

@test "secret-scan collect: empty raw -> no findings" {
  printf '%s' '{"tool":"gitleaks","rc":0,"raw":[]}' >out.json
  printf '[]' >finds.json
  _mumei_det_secret_scan_collect out.json finds.json
  run jq 'length' finds.json
  [ "$output" = "0" ]
}

# ─── type-check collect ───────────────────────────────────────

@test "type-check collect: rc=0 -> no findings (clean)" {
  printf '%s' '{"tool":"tsc","rc":0,"text":""}' >out.json
  printf '[]' >finds.json
  _mumei_det_type_check_collect out.json finds.json
  run jq 'length' finds.json
  [ "$output" = "0" ]
}

@test "type-check collect: mypy diagnostics -> per-line HIGH findings" {
  printf '%s' '{"tool":"mypy","rc":1,"text":"src/app.py:42: error: Incompatible types\nsrc/util.py:7: error: Missing return"}' >out.json
  printf '[]' >finds.json
  _mumei_det_type_check_collect out.json finds.json
  run jq 'length' finds.json
  [ "$output" = "2" ]
  run jq -r '.[0].location.file' finds.json
  [ "$output" = "src/app.py" ]
  run jq -r '.[0].location.line' finds.json
  [ "$output" = "42" ]
  run jq -r '.[0].precision_class' finds.json
  [ "$output" = "ground_truth" ]
}

@test "type-check collect: rc!=0 with no parseable line -> one aggregate finding" {
  printf '%s' '{"tool":"cargo","rc":101,"text":"error: could not compile project"}' >out.json
  printf '[]' >finds.json
  _mumei_det_type_check_collect out.json finds.json
  run jq 'length' finds.json
  [ "$output" = "1" ]
  run jq -r '.[0].location.file' finds.json
  [ "$output" = "(project)" ]
}

# ─── test-check collect ───────────────────────────────────────

@test "test-check collect: failing verify-log entry -> HIGH finding" {
  printf '%s' '{"latest":{"cmd":"npm test","exit_code":1,"source":"commit-gate"}}' >out.json
  printf '[]' >finds.json
  _mumei_det_test_check_collect out.json finds.json
  run jq -r '.[0].severity' finds.json
  [ "$output" = "HIGH" ]
  run jq -r '.[0].precision_class' finds.json
  [ "$output" = "ground_truth" ]
}

@test "test-check collect: passing verify-log entry -> no findings" {
  printf '%s' '{"latest":{"cmd":"npm test","exit_code":0}}' >out.json
  printf '[]' >finds.json
  _mumei_det_test_check_collect out.json finds.json
  run jq 'length' finds.json
  [ "$output" = "0" ]
}

@test "test-check collect: no latest entry -> no findings" {
  printf '%s' '{"latest":null}' >out.json
  printf '[]' >finds.json
  _mumei_det_test_check_collect out.json finds.json
  run jq 'length' finds.json
  [ "$output" = "0" ]
}
