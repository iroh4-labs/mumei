#!/usr/bin/env bash
# PreToolUse(ExitPlanMode) hook (L-P1) — plan-vehicle plan capture.
#
# When the user accepts a plan in Claude's plan mode, this hook captures
# the planFilePath into .mumei/plans/<slug>/plan.md and initializes
# .mumei/plans/<slug>/state.json with the plan-vehicle schema. The hook
# is idempotent: if the plan-vehicle state.json already exists, it
# leaves things alone. If a spec-vehicle state.json is active for the
# same slug, the hook does nothing (don't disturb spec-mid-flow).
#
# This hook never blocks (REQ-9.11). Failures emit a warning to stderr
# and the hook exits 0 so plan mode is never broken by mumei.
#
# Slug derivation (REQ-9.34):
#   - if .mumei/current exists, use its first line as slug
#   - else, derive from basename of tool_input.planFilePath (stripping .md)

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

PLAN_FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.planFilePath // empty')"

# No planFilePath means the tool_input shape is unexpected — bail silently.
if [[ -z "$PLAN_FILE_PATH" ]]; then
  exit 0
fi

# Determine slug.
SLUG=""
if [[ -f .mumei/current ]]; then
  SLUG="$(head -n1 .mumei/current | tr -d '[:space:]')"
fi
if [[ -z "$SLUG" ]]; then
  # Derive from planFilePath basename, dropping .md
  SLUG="$(basename "$PLAN_FILE_PATH")"
  SLUG="${SLUG%.md}"
fi

# Sanity: if we still have no slug, bail.
if [[ -z "$SLUG" ]]; then
  exit 0
fi

# If a spec-vehicle state.json already exists for this key, skip — the
# user is mid-spec and plan mode is being used internally, not as the
# vehicle root.
if [[ -f ".mumei/specs/${SLUG}/state.json" ]]; then
  exit 0
fi

# If plan-vehicle state.json already exists, idempotent skip.
if [[ -f ".mumei/plans/${SLUG}/state.json" ]]; then
  exit 0
fi

# Capture plan markdown into the plan-vehicle dir.
mkdir -p ".mumei/plans/${SLUG}"
DEST=".mumei/plans/${SLUG}/plan.md"
if [[ -f "$PLAN_FILE_PATH" ]]; then
  if ! cp "$PLAN_FILE_PATH" "$DEST" 2>/dev/null; then
    mumei_log_warn "L-P1: failed to copy plan from ${PLAN_FILE_PATH} to ${DEST}"
  fi
else
  mumei_log_warn "L-P1: planFilePath does not exist on disk: ${PLAN_FILE_PATH} (state.json will still be initialized; plan.md fallback handled by Wave 3 task 3.4)"
fi

# Initialize state.json (idempotent — function returns 0 if file exists).
if ! mumei_state_init_plan "$SLUG" "$PLAN_FILE_PATH"; then
  mumei_log_warn "L-P1: failed to initialize plan-vehicle state.json for ${SLUG}"
  exit 0
fi

# Update .mumei/current if empty (user did not pre-set the slug).
if [[ ! -s .mumei/current ]]; then
  printf '%s\n' "$SLUG" >.mumei/current
fi

exit 0
