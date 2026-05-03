#!/usr/bin/env bash
# Stop hook.
# Rules covered:
#   R1: session ending with every task complete but no review run -> block to force continuation
#
# Design principles:
#   - Loop prevention: if stop_hook_active=true, exit 0 immediately.
#   - On block: emit decision: block + reason, so Claude runs /mumei:plan
#     review on the next turn.
#   - escape: MUMEI_BYPASS=1 -> exit 0 immediately

set -u

if [[ "${MUMEI_BYPASS:-0}" == "1" ]]; then
  exit 0
fi

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(realpath "$0")")")}"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/log.sh"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/state.sh"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/tasks.sh"

INPUT="$(cat)"

# Loop prevention: if a Stop hook is already blocking, allow immediately
STOP_HOOK_ACTIVE="$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')"
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
  exit 0
fi

FEATURE="$(mumei_current_feature 2>/dev/null || true)"
if [[ -z "$FEATURE" ]] || ! mumei_state_exists "$FEATURE"; then
  exit 0
fi

PHASE="$(mumei_state_phase "$FEATURE")"

# --- R3: phase=done while .mumei/current still points at the feature -> block and prompt archive ---
# After the orchestrator (/mumei:plan) advances phase=done with verdict=PASS,
# this prevents the session from ending without telling the user to run
# /mumei:archive. The archive skill is disable-model-invocation: true so Claude
# cannot run it itself; we enforce it via this Hook.
if [[ "$PHASE" == "done" ]]; then
  CURRENT="$(mumei_current_feature 2>/dev/null || true)"
  if [[ "$CURRENT" == "$FEATURE" ]]; then
    REASON="Feature ${FEATURE} reached phase=done but is still active in .mumei/current. Run /mumei:archive ${FEATURE} to move the spec, or clear .mumei/current."
    CONTEXT="The archive skill (/mumei:archive) is user-invocable only; the orchestrator cannot run it. Either invoke /mumei:archive to move the spec to .mumei/archive/<YYYY-MM>/, or clear .mumei/current to dismiss this gate. Set MUMEI_BYPASS=1 to skip (not recommended)."
    jq -n --arg r "$REASON" --arg c "$CONTEXT" '{
      decision: "block",
      reason: $r,
      hookSpecificOutput: {
        hookEventName: "Stop",
        additionalContext: $c
      }
    }'
    exit 0
  fi
fi

# Everything below applies only to phase=implement
[[ "$PHASE" == "implement" ]] || exit 0

# Check whether every task is complete
ANY_INCOMPLETE=0
while IFS= read -r tid; do
  [[ -n "$tid" ]] || continue
  st="$(mumei_tasks_status "$FEATURE" "$tid" 2>/dev/null || echo unknown)"
  if [[ "$st" != "complete" ]]; then
    ANY_INCOMPLETE=1
    break
  fi
done < <(mumei_tasks_list_ids "$FEATURE")

[[ "$ANY_INCOMPLETE" == "0" ]] || exit 0

# All tasks complete + missing or stale review -> block
REVIEW_DIR=".mumei/specs/${FEATURE}/reviews"
NEEDS_REVIEW=0
if [[ ! -d "$REVIEW_DIR" ]]; then
  NEEDS_REVIEW=1
else
  # Review file names are ISO 8601 timestamps, so alphabetical = chronological.
  # Exclude detector reports (<ts>-detectors.json) so we pin the actual review.
  LATEST_REVIEW="$(find "${REVIEW_DIR}" -maxdepth 1 -type f -name '*.json' \
                     ! -name '*-detectors.json' 2>/dev/null | sort | tail -n1)"
  if [[ -z "$LATEST_REVIEW" ]]; then
    NEEDS_REVIEW=1
  else
    # If the review is older than tasks.md it is stale -> re-review required
    if [[ ".mumei/specs/${FEATURE}/tasks.md" -nt "$LATEST_REVIEW" ]]; then
      NEEDS_REVIEW=1
    fi
  fi
fi

if [[ "$NEEDS_REVIEW" == "1" ]]; then
  REASON="All tasks complete but review pending. Run /mumei:plan to invoke the 4-stage review and per-issue validator before finishing."
  CONTEXT="Feature ${FEATURE} has all tasks marked [x] but no current review result exists in .mumei/specs/${FEATURE}/reviews/. The review phase is required before phase=done. Set MUMEI_BYPASS=1 to skip (not recommended)."
  jq -n --arg r "$REASON" --arg c "$CONTEXT" '{
    decision: "block",
    reason: $r,
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: $c
    }
  }'
  exit 0
fi

# --- Detector defense line: skill-led Stage 0 must have written a matching
# <ts>-detectors.json next to the review. If it didn't, Stage 0 was skipped
# (skill bug, manually-authored review, etc.) and we must force a re-run.
REVIEW_TS="$(basename "$LATEST_REVIEW" .json)"
DETECTORS_FILE="${REVIEW_DIR}/${REVIEW_TS}-detectors.json"
if [[ ! -f "$DETECTORS_FILE" ]]; then
  REASON="Review at ${REVIEW_TS} has no matching detectors.json — Stage 0 (deterministic detector run) was skipped. Re-run /mumei:plan review."
  CONTEXT="Expected file: ${DETECTORS_FILE}. The /mumei:plan skill must execute hooks/pre-review-detector.sh before reviewer fan-out so detectors (semgrep, osv-scanner, hallucinated-package-check) emit ground-truth findings. Set MUMEI_BYPASS=1 to skip (not recommended)."
  jq -n --arg r "$REASON" --arg c "$CONTEXT" '{
    decision: "block",
    reason: $r,
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: $c
    }
  }'
  exit 0
fi

exit 0
