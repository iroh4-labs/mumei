#!/usr/bin/env bash
# Cost-log helpers for reviewer / curator Task invocations (REQ-11.5).
#
# Target file: .mumei/specs/<feature>/cost-log.jsonl  (per-feature, JSONL append-only).
# Caller pattern (in skills/plan/SKILL.md Phase 5 / skills/review/SKILL.md):
#
#   mumei_cost_log_before "$feature" "$current_wave" "$current_iter" "spec-compliance-reviewer"
#   # ... launch the Task subagent ...
#   mumei_cost_log_after  "$feature" "$current_wave" "$current_iter" "spec-compliance-reviewer" "$usage_json"
#
# `usage_json` is the JSON object captured from the subagent's final usage
# block (input_tokens / output_tokens / cache_read_input_tokens /
# cache_creation_input_tokens). Pass `{}` if usage cannot be observed.
# Aggregation is provided by scripts/aggregate-cost.sh.
#
# Per-feature cost-log.jsonl is intentionally NOT a target of
# log-rotate.sh (REQ-14.12): the file moves with the feature into
# .mumei/archive/ via /mumei:archive, so its lifecycle is bounded by
# the feature itself rather than by long-lived disk pressure.

set -u

if ! declare -F mumei_log_info >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/log.sh"
fi

if ! declare -F mumei_state_is_plan_vehicle >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/state.sh"
fi

# Echo the cost-log path for a given feature. spec-vehicle features land
# under .mumei/specs/, plan-vehicle slugs under .mumei/plans/, so the
# cost-log travels with the feature into archive/. No I/O, no mkdir.
mumei_cost_log_path() {
  local feature="$1"
  if mumei_state_is_plan_vehicle "$feature" 2>/dev/null; then
    printf '.mumei/plans/%s/cost-log.jsonl' "$feature"
  else
    printf '.mumei/specs/%s/cost-log.jsonl' "$feature"
  fi
}

# Append a "before" record to the cost-log. Silent on success.
# Args: feature wave iter agent
mumei_cost_log_before() {
  local feature="$1" wave="$2" iter="$3" agent="$4"
  local path
  path="$(mumei_cost_log_path "$feature")"
  mkdir -p "$(dirname "$path")"
  jq -nc --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg feature "$feature" \
    --argjson wave "${wave:-null}" \
    --argjson iter "${iter:-null}" \
    --arg agent "$agent" \
    '{ts: $ts, feature: $feature, wave: $wave, iteration: $iter, agent: $agent, phase: "before"}' \
    >>"$path"
}

# Append an "after" record to the cost-log. usage_json should be the
# raw usage object from the subagent response; pass `{}` if unavailable.
# Args: feature wave iter agent usage_json
mumei_cost_log_after() {
  local feature="$1" wave="$2" iter="$3" agent="$4" usage_json="$5"
  local path
  path="$(mumei_cost_log_path "$feature")"
  mkdir -p "$(dirname "$path")"

  # Defense: ensure usage_json parses; fall back to {} on garbage so the
  # cost-log stays JSONL-clean.
  if ! jq -e 'type == "object"' <<<"$usage_json" >/dev/null 2>&1; then
    usage_json='{}'
  fi

  jq -nc --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg feature "$feature" \
    --argjson wave "${wave:-null}" \
    --argjson iter "${iter:-null}" \
    --arg agent "$agent" \
    --argjson u "$usage_json" \
    '{
      ts: $ts,
      feature: $feature,
      wave: $wave,
      iteration: $iter,
      agent: $agent,
      phase: "after",
      input_tokens: ($u.input_tokens // 0),
      output_tokens: ($u.output_tokens // 0),
      cache_read_input_tokens: ($u.cache_read_input_tokens // 0),
      cache_creation_input_tokens: ($u.cache_creation_input_tokens // 0)
    }' >>"$path"
}
