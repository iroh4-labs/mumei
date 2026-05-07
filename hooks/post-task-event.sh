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

# Counter mutation must be serialized — without a lock, two concurrent
# Claude Code sessions on the same project race on read+write and lose
# increments, leaving task_completed_count != task_created_count and
# pending_review never firing. Use mkdir-based atomic locking (portable
# across macOS / Linux / BSD; flock is util-linux and not on macOS by
# default). mkdir is POSIX atomic — if the directory already exists,
# the call fails with rc=1, signalling another process holds the lock.
mkdir -p ".mumei/plans/${SLUG}"
LOCK_DIR=".mumei/plans/${SLUG}/.lock-dir"

acquired=0
# Up to ~5s with 200ms back-off: 25 attempts * 0.2s. Caps total wait
# without busy-spinning. If we still cannot acquire, the contending
# process will set the counter we care about — bail rather than block.
for _ in $(seq 1 25); do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    acquired=1
    break
  fi
  # Stale lock recovery: if the lock dir was created more than 30s ago,
  # the holder almost certainly crashed (no critical section legitimately
  # holds for 30s). Force-clear and retry once.
  if [[ -d "$LOCK_DIR" ]] &&
    [[ -z "$(find "$LOCK_DIR" -maxdepth 0 -mmin -0.5 2>/dev/null)" ]]; then
    rmdir "$LOCK_DIR" 2>/dev/null || true
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      mumei_log_warn "post-task-event: cleared stale lock for ${SLUG} (held >30s)"
      acquired=1
      break
    fi
  fi
  sleep 0.2
done

if [[ "$acquired" == "0" ]]; then
  mumei_log_warn "post-task-event: could not acquire lock for ${SLUG} within 5s; skipping increment"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

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
