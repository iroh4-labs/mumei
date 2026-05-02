#!/usr/bin/env bash
# 共通ログ関数。stderr に書き出す (stdout は Hook の JSON 出力用に予約)。
# 使い方: source "${CLAUDE_PLUGIN_ROOT}/hooks/_lib/log.sh"

set -u

# MUMEI_DEBUG=1 で debug log を有効化
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
