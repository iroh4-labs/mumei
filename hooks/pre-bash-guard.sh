#!/usr/bin/env bash
# PreToolUse Bash hook.
# 担当ルール:
#   I3: test red のまま git commit → deny
#   R2: review verdict が MAJOR_ISSUES のまま git push → deny
#   W2: Wave 内 [ ] 残のまま git commit → deny
#
# 設計原則:
#   - escape: MUMEI_BYPASS=1 で即 exit 0
#   - 出力: deny 時は permissionDecision JSON
#   - test runner の自動検出は package.json / pyproject.toml / Cargo.toml ベース

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
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
[[ -n "$COMMAND" ]] || exit 0

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

# git commit を含むか判定 (chain command 対応)。
is_git_commit() {
  printf '%s' "$1" | grep -qE '(^|[[:space:];|&])git[[:space:]]+commit([[:space:]]|$)'
}

# git push を含むか判定。
is_git_push() {
  printf '%s' "$1" | grep -qE '(^|[[:space:];|&])git[[:space:]]+push([[:space:]]|$)'
}

# --- W2: Wave 内 [ ] 残のまま git commit ---
if is_git_commit "$COMMAND"; then
  CURRENT_WAVE="$(mumei_state_get "$FEATURE" '.current_wave // 0')"
  if [[ -n "$CURRENT_WAVE" ]] && [[ "$CURRENT_WAVE" -gt 0 ]]; then
    if ! mumei_tasks_wave_complete "$FEATURE" "$CURRENT_WAVE"; then
      INCOMPLETE_TASKS="$(mumei_tasks_list_ids "$FEATURE" | while IFS= read -r tid; do
        wave="${tid%%.*}"
        [[ "$wave" == "$CURRENT_WAVE" ]] || continue
        st="$(mumei_tasks_status "$FEATURE" "$tid" 2>/dev/null || echo unknown)"
        [[ "$st" == "incomplete" ]] && printf '%s ' "$tid"
      done)"
      deny \
        "Wave ${CURRENT_WAVE} has incomplete tasks: ${INCOMPLETE_TASKS}. Complete or revert before committing." \
        "Mark each task [x] in .mumei/specs/${FEATURE}/tasks.md after the implementation is done, or revert pending changes."
    fi
  fi

  # --- I3: test red のまま git commit ---
  # test runner を検出して実行。失敗 (exit != 0) なら deny。
  TEST_CMD=""
  if [[ -f "package.json" ]]; then
    if jq -e '.scripts.test // empty' package.json >/dev/null 2>&1; then
      TEST_CMD="npm test --silent"
    fi
  elif [[ -f "pyproject.toml" ]]; then
    if grep -q 'pytest' pyproject.toml 2>/dev/null; then
      TEST_CMD="pytest -q"
    fi
  elif [[ -f "Cargo.toml" ]]; then
    TEST_CMD="cargo test --quiet"
  elif [[ -f "go.mod" ]]; then
    TEST_CMD="go test ./..."
  fi

  if [[ -n "$TEST_CMD" ]]; then
    # MUMEI_SKIP_TEST=1 で test runner skip (CI などで個別制御したい場合)
    if [[ "${MUMEI_SKIP_TEST:-0}" != "1" ]]; then
      mumei_log_info "running tests before commit: ${TEST_CMD}"
      if ! TEST_OUTPUT="$(eval "$TEST_CMD" 2>&1)"; then
        # 失敗テスト名を最大 5 個抽出 (truncate)
        TEST_TAIL="$(printf '%s' "$TEST_OUTPUT" | tail -n 30)"
        deny \
          "Tests failing. Fix before committing." \
          "Test command: ${TEST_CMD}\n\n${TEST_TAIL}"
      fi
    fi
  fi
fi

# --- R2: review verdict が MAJOR_ISSUES のまま git push ---
if is_git_push "$COMMAND"; then
  # 直近の review 結果を確認。 .mumei/specs/<f>/reviews/<latest>.json の verdict を読む。
  REVIEW_DIR=".mumei/specs/${FEATURE}/reviews"
  if [[ -d "$REVIEW_DIR" ]]; then
    LATEST_REVIEW="$(ls -1t "${REVIEW_DIR}"/*.json 2>/dev/null | head -n1 || true)"
    if [[ -n "$LATEST_REVIEW" ]] && [[ -f "$LATEST_REVIEW" ]]; then
      VERDICT="$(jq -r '.verdict // empty' "$LATEST_REVIEW" 2>/dev/null || true)"
      if [[ "$VERDICT" == "MAJOR_ISSUES" ]]; then
        deny \
          "Review verdict: MAJOR_ISSUES. Address findings before pushing." \
          "Latest review: ${LATEST_REVIEW}\nRun /mumei:plan to address findings and re-review."
      fi
    fi
  fi
fi

exit 0
