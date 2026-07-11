#!/usr/bin/env bash
# ConfigChange: audit log + invalid JSON gate.
#
# Records each settings change (`config_source`, `changed_fields`) to an
# append-only JSONL audit log. If the changed settings file is unparsable
# JSON, exits 2 to block the change.
#
# Env knobs:
#   MUMEI_BYPASS=1 — short-circuit (silent exit, no validation, no audit)

set -u

# Anchor cwd to the project root so relative .mumei/ paths land
# in the right place when invoked from a subdir (monorepo dev).
# shellcheck source=_lib/anchor.sh disable=SC1091
source "${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(realpath "$0")")")}/hooks/_lib/anchor.sh"

# shellcheck disable=SC1091
source "$(dirname "${BASH_SOURCE[0]}")/_lib/audit-log.sh"

INPUT="$(cat 2>/dev/null || true)"
[[ -z "$INPUT" ]] && exit 0

CONFIG_SOURCE="$(jq -r '.config_source // empty' <<<"$INPUT" 2>/dev/null || true)"
CHANGED_FIELDS="$(jq -c '.changed_fields // []' <<<"$INPUT" 2>/dev/null || echo '[]')"

[[ -z "$CONFIG_SOURCE" ]] && exit 0

# Map config_source to a canonical settings file path for JSON validation.
# Best-effort: relies on conventional locations.
SETTINGS_PATH=""
case "$CONFIG_SOURCE" in
project_settings) SETTINGS_PATH=".claude/settings.json" ;;
local_settings) SETTINGS_PATH=".claude/settings.local.json" ;;
user_settings) SETTINGS_PATH="${HOME}/.claude/settings.json" ;;
policy_settings | skills) SETTINGS_PATH="" ;; # not directly file-mapped
esac

VALID="true"
if [[ -n "$SETTINGS_PATH" && -f "$SETTINGS_PATH" ]]; then
  if ! jq empty "$SETTINGS_PATH" >/dev/null 2>&1; then
    VALID="false"
  fi
fi

# --- X7: ConfigChange — a settings write turned MUMEI_BYPASS on (advisory) ---
# S3 refuses the obvious write (Edit/Write, or a Bash command naming both the
# settings file and the variable). It cannot refuse a write it does not read — a
# python one-liner, a heredoc written to a script and then run. This fires on the
# resulting state change instead of on the command, so the route taken does not
# matter. It is the backstop, and it is why S3 is allowed to be imperfect.
#
# Advisory, not a block: the operator is entitled to set the escape hatch. What
# they are not entitled to is having it set for them, quietly. So it is recorded
# in the audit log and said out loud.
if [[ -n "$SETTINGS_PATH" && -f "$SETTINGS_PATH" ]] &&
  jq -e '.env.MUMEI_BYPASS? // empty | tostring | . == "1"' "$SETTINGS_PATH" >/dev/null 2>&1; then
  BYPASS_LINE="$(jq -n -c --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg src "$CONFIG_SOURCE" --arg path "$SETTINGS_PATH" \
    '{ts: $ts, event: "bypass-enabled-via-settings", config_source: $src, path: $path}' 2>/dev/null || true)"
  [[ -n "$BYPASS_LINE" ]] && mumei_audit_log_append "config-change" "$BYPASS_LINE"
  printf '[mumei] X7: %s now sets MUMEI_BYPASS=1 — from the next session every mumei gate is disabled. If you did not do this, someone with write access to your settings did.\n' \
    "$SETTINGS_PATH" >&2
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
JSON_LINE="$(jq -n -c \
  --arg ts "$TS" \
  --arg config_source "$CONFIG_SOURCE" \
  --argjson changed_fields "$CHANGED_FIELDS" \
  --arg valid "$VALID" \
  '{ts: $ts, config_source: $config_source, changed_fields: $changed_fields, valid: ($valid == "true")}' 2>/dev/null || true)"

[[ -n "$JSON_LINE" ]] && mumei_audit_log_append "config-change" "$JSON_LINE"

if [[ "$VALID" == "false" ]]; then
  # Demoted from exit 2 (block) to warning-only (exit 0): editor mid-save
  # / git pull conflict markers / transient parse failure are common at
  # the time ConfigChange fires. Blocking here is non-actionable for the
  # user. The audit-log record above keeps `valid: false` for
  # downstream review. Pre-edit-style enforcement should live in
  # pre-edit-guard.sh, not in this post-change observer.
  printf '[mumei] config-change warning: %s contains invalid JSON (recorded as valid=false in audit log)\n' "$SETTINGS_PATH" >&2
fi

exit 0
