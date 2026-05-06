#!/usr/bin/env bash
# Read/write helpers for .mumei/specs/<feature>/state.json.
# Uses atomic write (tmp + mv) to avoid torn reads.
# Dependencies: jq

set -u

# Load log.sh on import (guarded against double sourcing)
if ! declare -F mumei_log_info >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/log.sh"
fi

# Paths relative to the project root
mumei_state_dir() {
  printf '%s' ".mumei"
}

mumei_specs_dir() {
  printf '%s' ".mumei/specs"
}

mumei_archive_dir() {
  printf '%s' ".mumei/archive"
}

# Return the current active feature slug. Exit 1 if none.
mumei_current_feature() {
  local f=".mumei/current"
  [[ -f "$f" ]] || return 1
  local slug
  slug="$(head -n1 "$f" | tr -d '[:space:]')"
  [[ -n "$slug" ]] || return 1
  printf '%s' "$slug"
}

# Path to the given feature's state.json.
mumei_state_path() {
  local feature="$1"
  printf '%s' ".mumei/specs/${feature}/state.json"
}

# Check whether state.json exists. Exit 1 if missing.
mumei_state_exists() {
  local feature="$1"
  [[ -f "$(mumei_state_path "$feature")" ]]
}

# Return the value at the given jq path inside state.json.
# Example: mumei_state_get "REQ-1-user-auth" '.phase'
mumei_state_get() {
  local feature="$1"
  local jq_path="$2"
  local sf
  sf="$(mumei_state_path "$feature")"
  [[ -f "$sf" ]] || return 1
  jq -r "$jq_path // empty" "$sf"
}

# Replace state.json atomically.
# Usage: echo '{"phase":"implement"}' | mumei_state_write_full "REQ-1-user-auth"
mumei_state_write_full() {
  local feature="$1"
  local sf
  sf="$(mumei_state_path "$feature")"
  local dir
  dir="$(dirname "$sf")"
  mkdir -p "$dir"
  local tmp
  tmp="$(mktemp "${sf}.XXXXXX")"
  cat >"$tmp"
  # validate JSON before commit
  if ! jq empty <"$tmp" 2>/dev/null; then
    rm -f "$tmp"
    mumei_log_error "invalid JSON for state.json (feature=${feature})"
    return 1
  fi
  mv "$tmp" "$sf"
}

# Set a scalar value at the given jq path in state.json (atomic).
# Example: mumei_state_set "REQ-1-user-auth" '.phase' '"review"'
# The third argument is a raw JSON value (caller must quote strings).
mumei_state_set() {
  local feature="$1"
  local jq_path="$2"
  local json_value="$3"
  local sf
  sf="$(mumei_state_path "$feature")"
  [[ -f "$sf" ]] || {
    mumei_log_error "state.json not found for ${feature}"
    return 1
  }
  jq "$jq_path = $json_value | .updated_at = (now | todateiso8601)" "$sf" |
    mumei_state_write_full "$feature"
}

# Return the current phase (plan / implement / review / done).
mumei_state_phase() {
  local feature="$1"
  mumei_state_get "$feature" '.phase'
}

# Reconcile detectable state.json inconsistencies and return 0 on
# success. Reports each correction to stderr via mumei_log_warn. Idempotent.
#
# Currently reconciles:
#   - phase=plan but approved_at != null  → advance phase=implement,
#     current_wave=1 (the orchestrator failed to set the post-approval
#     phase, e.g. session terminated between user approval and the
#     skill's mumei_state_set call). The user already approved; the
#     state machine just lost the resulting transition.
#
# Future inconsistencies should be added here rather than scattered
# across hook handlers, so the orchestrator (/mumei:plan) can call
# this at startup as a single self-heal pass.
mumei_state_reconcile() {
  local feature="$1"
  local sf
  sf="$(mumei_state_path "$feature")"
  [[ -f "$sf" ]] || return 1

  local phase approved current_wave
  phase="$(jq -r '.phase // empty' "$sf" 2>/dev/null || true)"
  approved="$(jq -r '.approved_at // empty' "$sf" 2>/dev/null || true)"
  current_wave="$(jq -r '.current_wave // 0' "$sf" 2>/dev/null || echo 0)"

  if [[ "$phase" == "plan" ]] && [[ -n "$approved" ]]; then
    mumei_log_warn "state.sh: ${feature} has approved_at=${approved} but phase=plan; auto-advancing to phase=implement (post-approval transition was lost)"
    mumei_state_set "$feature" '.phase' '"implement"' || return 1
    if [[ "$current_wave" == "0" ]]; then
      mumei_state_set "$feature" '.current_wave' '1' || return 1
    fi
  fi

  return 0
}

# Initialize state.json. Skip if it already exists.
mumei_state_init() {
  local feature="$1"
  local slug="$2"
  local id="$3"
  local sf
  sf="$(mumei_state_path "$feature")"
  [[ -f "$sf" ]] && return 0
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n \
    --arg id "$id" \
    --arg slug "$slug" \
    --arg now "$now" \
    '{
      id: $id,
      slug: $slug,
      phase: "plan",
      current_wave: 0,
      created_at: $now,
      updated_at: $now
    }' | mumei_state_write_full "$feature"
}
