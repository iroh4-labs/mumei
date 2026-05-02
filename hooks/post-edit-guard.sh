#!/usr/bin/env bash
# PostToolUse Edit|Write|MultiEdit hook.
# 担当ルール:
#   I4: task 完了マーク [x] を実装伴わず付与 (phantom completion) → block + reason 注入
#
# 設計原則:
#   - PostToolUse は tool 実行を取り消せない。decision: block で agent loop に介入する。
#   - 検出ロジック: tasks.md の編集で新しく [x] 化された task について、
#     その task の _Files: に列挙されたファイルが直近 git diff に出現するか確認。
#     出現しない = phantom completion。
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
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
[[ -n "$FILE_PATH" ]] || exit 0

# 相対パス正規化
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]] && [[ "$FILE_PATH" == "${CLAUDE_PROJECT_DIR}"* ]]; then
  FILE_PATH="${FILE_PATH#"${CLAUDE_PROJECT_DIR}"/}"
fi

FEATURE="$(mumei_current_feature 2>/dev/null || true)"
if [[ -z "$FEATURE" ]] || ! mumei_state_exists "$FEATURE"; then
  exit 0
fi

# tasks.md の編集に限定
TASKS_FILE=".mumei/specs/${FEATURE}/tasks.md"
[[ "$FILE_PATH" == "$TASKS_FILE" ]] || exit 0

# git で直前の tasks.md 状態を取得し、新しく [x] になった task ID を検出。
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  # git なしでは検出不能、スキップ
  exit 0
fi

# tasks.md の差分から `+- [x] ` 行を抜き出す
DIFF="$(git diff HEAD -- "$TASKS_FILE" 2>/dev/null || true)"
if [[ -z "$DIFF" ]]; then
  # 既に commit 済 or 変更なし
  exit 0
fi

NEWLY_COMPLETED="$(printf '%s' "$DIFF" \
  | grep -E '^\+- \[x\] [0-9]+(\.[0-9]+)*' \
  | sed -E 's/^\+- \[x\] ([0-9]+(\.[0-9]+)*).*/\1/')"

[[ -n "$NEWLY_COMPLETED" ]] || exit 0

# 各完了 task について、その _Files: のファイルが diff に存在するか確認
PHANTOM_TASKS=""
while IFS= read -r task_id; do
  [[ -n "$task_id" ]] || continue
  files="$(mumei_tasks_files "$FEATURE" "$task_id" 2>/dev/null || true)"
  [[ -n "$files" ]] || { PHANTOM_TASKS+="${task_id} "; continue; }

  has_implementation=0
  IFS=',' read -ra file_arr <<< "$files"
  for f in "${file_arr[@]}"; do
    f="$(echo "$f" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    [[ -n "$f" ]] || continue
    # tasks.md 自体は除外
    [[ "$f" == "$TASKS_FILE" ]] && continue
    # diff に該当ファイルの変更があるか (HEAD vs worktree、staged 含む)
    if git diff --name-only HEAD 2>/dev/null | grep -qFx "$f"; then
      has_implementation=1
      break
    fi
    # untracked file も含める (git ls-files は厳密にファイルパスを照合する)
    if [[ -n "$(git ls-files --others --exclude-standard -- "$f" 2>/dev/null)" ]]; then
      has_implementation=1
      break
    fi
  done

  if [[ "$has_implementation" == "0" ]]; then
    PHANTOM_TASKS+="${task_id} "
  fi
done <<< "$NEWLY_COMPLETED"

if [[ -n "$PHANTOM_TASKS" ]]; then
  REASON="Task(s) marked [x] without implementation: ${PHANTOM_TASKS%% }. Phantom completion blocked."
  CONTEXT="The following tasks were marked complete in tasks.md but the files listed in their _Files: meta were not modified in this session: ${PHANTOM_TASKS%% }. Either implement the changes or revert the [x] mark."
  jq -n --arg r "$REASON" --arg c "$CONTEXT" '{
    decision: "block",
    reason: $r,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: $c
    }
  }'
  exit 0
fi

exit 0
