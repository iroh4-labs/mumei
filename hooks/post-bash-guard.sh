#!/usr/bin/env bash
# PostToolUse Bash hook.
# 担当ルール:
#   X1: Bash 経由でスコープ外ファイル変更 → 警告のみ (block しない)
#
# 設計原則:
#   - X1 は副作用大きい block ではなく、Claude に additionalContext で警告
#   - block すると正当な操作 (例えば npm install で node_modules 変更) も止まる
#   - escape: MUMEI_BYPASS=1 で即 exit 0

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

FEATURE="$(mumei_current_feature 2>/dev/null || true)"
if [[ -z "$FEATURE" ]] || ! mumei_state_exists "$FEATURE"; then
  exit 0
fi

PHASE="$(mumei_state_phase "$FEATURE")"
[[ "$PHASE" == "implement" ]] || exit 0

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# 直前の Bash 実行で変更されたファイルを git status で検出
CHANGED_FILES="$(git status --porcelain 2>/dev/null \
  | awk '{print $2}' \
  | grep -vE '^(\.mumei/|\.claude/|node_modules/|\.git/|dist/|build/|target/|\.next/|\.venv/|__pycache__/)' \
  || true)"

[[ -n "$CHANGED_FILES" ]] || exit 0

# tasks.md にスコープ登録されていないファイルがあれば warning
OUT_OF_SCOPE=""
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  owners="$(mumei_tasks_owners_of_file "$FEATURE" "$f" 2>/dev/null || true)"
  if [[ -z "$owners" ]]; then
    OUT_OF_SCOPE+="${f}\n"
  fi
done <<< "$CHANGED_FILES"

if [[ -n "$OUT_OF_SCOPE" ]]; then
  CONTEXT=$'The following files were modified via Bash but are NOT listed in any task\'s _Files: meta in .mumei/specs/'"${FEATURE}"$'/tasks.md:\n\n'"${OUT_OF_SCOPE}"$'\nIf these changes are intentional, add the files to the appropriate task\'s _Files: line. Otherwise revert them.'
  jq -n --arg c "$CONTEXT" '{
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: $c
    }
  }'
fi

exit 0
