#!/usr/bin/env bash
# TaskCreated / TaskCompleted hook (L-T1 + L-T2) — plan-vehicle counters.
#
# Increments task_created_count on TaskCreated. Increments
# task_completed_count on TaskCompleted, and sets pending_review=true
# when (task_completed_count == task_created_count > 0).
#
# This hook never blocks (REQ-9.14 — TaskCompleted is treated as a
# notification, since `decision: "block"` cannot undo the status
# transition per V4). It also no-ops for non-plan-vehicle sessions
# (spec vehicle, or projects without mumei).

set -u

# escape hatch
if [[ "${MUMEI_BYPASS:-0}" == "1" ]]; then
  exit 0
fi

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(realpath "$0")")")}"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/log.sh"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/state.sh"

INPUT="$(cat)"

EVENT="$(printf '%s' "$INPUT" | jq -r '.hook_event_name // empty')"
[[ -n "$EVENT" ]] || exit 0

# Resolve active slug from .mumei/current
SLUG=""
if [[ -f .mumei/current ]]; then
  SLUG="$(head -n1 .mumei/current | tr -d '[:space:]')"
fi
[[ -n "$SLUG" ]] || exit 0

# Only act when this is a plan-vehicle feature.
mumei_state_is_plan_vehicle "$SLUG" || exit 0

case "$EVENT" in
TaskCreated)
  current="$(mumei_state_read_any "$SLUG" '.task_created_count')"
  [[ -n "$current" ]] || current=0
  next=$((current + 1))
  if ! mumei_plan_state_set "$SLUG" '.task_created_count' "$next"; then
    mumei_log_warn "L-T1: failed to increment task_created_count for ${SLUG}"
  fi
  ;;
TaskCompleted)
  completed="$(mumei_state_read_any "$SLUG" '.task_completed_count')"
  [[ -n "$completed" ]] || completed=0
  next_completed=$((completed + 1))
  if ! mumei_plan_state_set "$SLUG" '.task_completed_count' "$next_completed"; then
    mumei_log_warn "L-T2: failed to increment task_completed_count for ${SLUG}"
    exit 0
  fi
  created="$(mumei_state_read_any "$SLUG" '.task_created_count')"
  [[ -n "$created" ]] || created=0
  if [[ "$next_completed" == "$created" ]] && [[ "$created" != "0" ]]; then
    if ! mumei_plan_state_set "$SLUG" '.pending_review' 'true'; then
      mumei_log_warn "L-T2: failed to set pending_review=true for ${SLUG}"
    fi
  fi
  ;;
*)
  # Unknown event — no-op
  ;;
esac

exit 0
