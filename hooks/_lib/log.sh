#!/usr/bin/env bash
# Shared logging helpers. All output goes to stderr (stdout is reserved for the
# hook's JSON response).
# Usage: source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/log.sh"

set -u

# MUMEI_DEBUG=1 enables debug logging
mumei_log_debug() {
  [[ "${MUMEI_DEBUG:-0}" == "1" ]] || return 0
  printf '[mumei DEBUG] %s\n' "$*" >&2
}

mumei_log_info() {
  printf '[mumei] %s\n' "$*" >&2
}

mumei_log_warn() {
  printf '[mumei WARN] %s\n' "$*" >&2
}

mumei_log_error() {
  printf '[mumei ERROR] %s\n' "$*" >&2
}
