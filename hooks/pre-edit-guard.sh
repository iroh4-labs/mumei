#!/usr/bin/env bash
# PreToolUse Edit|Write|MultiEdit hook.
# 担当ルール:
#   P1: 仕様書未完成のまま src/ を編集 → deny
#   P2: requirements.md に [NEEDS CLARIFICATION] 残存のまま design.md 作成 → deny
#   P3: design.md なしで tasks.md 作成 → deny
#   I1: 前提タスク未完了のまま後タスクを編集 → deny
#   I2: tasks.md に列挙されていないファイルを編集 (scope creep) → deny
#   W1: 前 Wave 未 commit のまま次 Wave のファイルを編集 → deny
#
# 設計原則:
#   - escape: MUMEI_BYPASS=1 で即 exit 0
#   - 出力: deny 時は permissionDecision JSON を stdout、exit 0
#   - reason は事実形 (命令形は prompt-injection 防御で打ち消されうる)
#   - active feature が判定できなければ何もせず allow (mumei 未利用プロジェクトを邪魔しない)

set -u

# escape hatch
if [[ "${MUMEI_BYPASS:-0}" == "1" ]]; then
  exit 0
fi

# library を load
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$(realpath "$0")")")}"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/log.sh"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/state.sh"
# shellcheck disable=SC1091
source "${PLUGIN_ROOT}/hooks/_lib/tasks.sh"

# stdin から JSON を読む
INPUT="$(cat)"

# 編集対象ファイルパスを抽出
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
[[ -n "$FILE_PATH" ]] || exit 0

# 相対パスに正規化 (CLAUDE_PROJECT_DIR からの相対)
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]] && [[ "$FILE_PATH" == "${CLAUDE_PROJECT_DIR}"* ]]; then
  FILE_PATH="${FILE_PATH#"${CLAUDE_PROJECT_DIR}"/}"
fi

# active feature が無ければ何もしない (mumei 未利用)
FEATURE="$(mumei_current_feature 2>/dev/null || true)"
if [[ -z "$FEATURE" ]] || ! mumei_state_exists "$FEATURE"; then
  exit 0
fi

deny() {
  local reason="$1"
  local context="${2:-}"
  jq -n --arg r "$reason" --arg c "$context" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r,
      additionalContext: $c
    }
  }'
  exit 0
}

PHASE="$(mumei_state_phase "$FEATURE")"

# --- P2: requirements.md に [NEEDS CLARIFICATION] が残存のまま design.md を作ろうとした ---
if [[ "$FILE_PATH" == ".mumei/specs/${FEATURE}/design.md" ]]; then
  REQ_FILE=".mumei/specs/${FEATURE}/requirements.md"
  if [[ -f "$REQ_FILE" ]] && grep -q '\[NEEDS CLARIFICATION' "$REQ_FILE"; then
    deny \
      "requirements.md has unresolved [NEEDS CLARIFICATION] markers. Resolve them before drafting design." \
      "Run /mumei:plan to step through clarifications, or edit requirements.md directly to remove the markers."
  fi
fi

# --- P3: design.md なしで tasks.md を作ろうとした ---
if [[ "$FILE_PATH" == ".mumei/specs/${FEATURE}/tasks.md" ]]; then
  DESIGN_FILE=".mumei/specs/${FEATURE}/design.md"
  if [[ ! -f "$DESIGN_FILE" ]]; then
    deny \
      "design.md missing for feature ${FEATURE}. Generate design before tasks." \
      "Run /mumei:plan or create .mumei/specs/${FEATURE}/design.md first."
  fi
fi

# 一般的な project meta ファイルは scope/phase 判定の対象外。
# 拡充: dotfiles (.gitignore, .dockerignore, .editorconfig 等), 設定 (Makefile, *.toml, *.yaml,
# *.yml, *.lock, *.json), README, LICENSE, CLAUDE.md / AGENTS.md, .github/, .vscode/。
is_meta_path() {
  local p="$1"
  case "$p" in
    .mumei/*|.claude/*|.github/*|.vscode/*|.gitlab/*|.idea/*) return 0 ;;
    .[a-zA-Z]*) return 0 ;;            # dotfiles 全般 (.gitignore, .editorconfig, .npmrc, ...)
    README*|LICENSE*|CHANGELOG*|CONTRIBUTING*|CODEOWNERS|NOTICE*) return 0 ;;
    CLAUDE.md|AGENTS.md) return 0 ;;
    Makefile|Dockerfile*|Rakefile|Gemfile*|Procfile|justfile|Justfile) return 0 ;;
    *.toml|*.yaml|*.yml|*.lock|*.lockfile) return 0 ;;
    *.config.js|*.config.ts|*.config.mjs|*.config.cjs|*.config.json) return 0 ;;
    package.json|package-lock.json|tsconfig*.json|jsconfig*.json|composer.json) return 0 ;;
    biome.json|deno.json|deno.jsonc) return 0 ;;
  esac
  return 1
}

# --- P1: 仕様書未完成のまま src/ などを編集 ---
# meta ファイルは許可。それ以外で phase=plan なら deny。
if [[ "$PHASE" == "plan" ]]; then
  if ! is_meta_path "$FILE_PATH"; then
    deny \
      "Cannot edit ${FILE_PATH} while phase=plan for feature ${FEATURE}. Complete the spec (requirements/design/tasks) first." \
      "Current phase: plan. Approve all spec phases via /mumei:plan, then phase will advance to implement."
  fi
fi

# 以降は phase=implement 前提
if [[ "$PHASE" != "implement" ]]; then
  exit 0
fi

# meta ファイルは scope check の対象外
if is_meta_path "$FILE_PATH"; then
  exit 0
fi

# --- I2: tasks.md に列挙されていないファイルを編集 (scope creep) ---
OWNERS="$(mumei_tasks_owners_of_file "$FEATURE" "$FILE_PATH" 2>/dev/null || true)"
if [[ -z "$OWNERS" ]]; then
  deny \
    "File ${FILE_PATH} is out of scope: not listed in any task's _Files: meta in tasks.md." \
    "If editing this file is intentional, add it to the owning task's _Files: line in .mumei/specs/${FEATURE}/tasks.md, then retry."
fi

# --- I1: 前提タスク未完了のまま後タスクを編集 ---
# OWNERS は空白区切りの task ID リスト。最初の owner の依存を確認。
OWNER_TASK="$(printf '%s' "$OWNERS" | awk '{print $1}')"
if [[ -n "$OWNER_TASK" ]]; then
  DEPS="$(mumei_tasks_depends "$FEATURE" "$OWNER_TASK" 2>/dev/null || true)"
  if [[ -n "$DEPS" ]] && [[ "$DEPS" != "-" ]]; then
    IFS=',' read -ra dep_arr <<< "$DEPS"
    for dep in "${dep_arr[@]}"; do
      dep="$(echo "$dep" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
      [[ -n "$dep" ]] || continue
      DEP_STATUS="$(mumei_tasks_status "$FEATURE" "$dep" 2>/dev/null || echo "unknown")"
      if [[ "$DEP_STATUS" != "complete" ]]; then
        deny \
          "Task ${OWNER_TASK} depends on task ${dep} which is not yet complete. Complete task ${dep} first." \
          "Edit ${FILE_PATH} requires task ${dep} to be marked [x] in tasks.md before proceeding."
      fi
    done
  fi
fi

# --- W1: 前 Wave 未 commit のまま次 Wave のファイルを編集 ---
# 現在 task ID から Wave 番号を抽出 (例: 2.1 → Wave 2)。
TASK_WAVE="${OWNER_TASK%%.*}"
CURRENT_WAVE="$(mumei_state_get "$FEATURE" '.current_wave // 0')"
if [[ -n "$TASK_WAVE" ]] && [[ "$TASK_WAVE" -gt "$CURRENT_WAVE" ]]; then
  # 前 Wave の commit 状態を確認。git log で [wave-N] の commit が無いまたは
  # uncommitted な変更が specs/ 以外に残っていれば deny。
  if git rev-parse --git-dir >/dev/null 2>&1; then
    if [[ -n "$(git status --porcelain | grep -v '^?? \.mumei/' || true)" ]]; then
      deny \
        "Wave ${CURRENT_WAVE} has uncommitted changes. Commit them before starting Wave ${TASK_WAVE}." \
        "Run \`git status\` to inspect, then commit Wave ${CURRENT_WAVE} before editing files in Wave ${TASK_WAVE}."
    fi
  fi
fi

# 全チェック通過 → allow
exit 0
