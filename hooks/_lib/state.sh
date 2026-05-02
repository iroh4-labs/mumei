#!/usr/bin/env bash
# .mumei/specs/<feature>/state.json の read/write 関数。
# atomic write (tmp + mv) で torn read を回避する。
# 依存: jq

set -u

# ロード時に log.sh をロード (二重 source 防止のためガード)
if ! declare -F mumei_log_info >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/log.sh"
fi

# プロジェクトルートからの相対パス
mumei_state_dir() {
  printf '%s' ".mumei"
}

mumei_specs_dir() {
  printf '%s' ".mumei/specs"
}

mumei_archive_dir() {
  printf '%s' ".mumei/archive"
}

# 現 active feature の slug を返す。空なら exit 1。
mumei_current_feature() {
  local f=".mumei/current"
  [[ -f "$f" ]] || return 1
  local slug
  slug="$(head -n1 "$f" | tr -d '[:space:]')"
  [[ -n "$slug" ]] || return 1
  printf '%s' "$slug"
}

# 指定 feature の state.json パス。
mumei_state_path() {
  local feature="$1"
  printf '%s' ".mumei/specs/${feature}/state.json"
}

# state.json の存在確認。なければ exit 1。
mumei_state_exists() {
  local feature="$1"
  [[ -f "$(mumei_state_path "$feature")" ]]
}

# state.json の指定 jq path の値を返す。
# 例: mumei_state_get "REQ-1-user-auth" '.phase'
mumei_state_get() {
  local feature="$1"
  local jq_path="$2"
  local sf
  sf="$(mumei_state_path "$feature")"
  [[ -f "$sf" ]] || return 1
  jq -r "$jq_path // empty" "$sf"
}

# state.json を atomic に書き換える。
# 使い方: echo '{"phase":"implement"}' | mumei_state_write_full "REQ-1-user-auth"
mumei_state_write_full() {
  local feature="$1"
  local sf
  sf="$(mumei_state_path "$feature")"
  local dir
  dir="$(dirname "$sf")"
  mkdir -p "$dir"
  local tmp
  tmp="$(mktemp "${sf}.XXXXXX")"
  cat > "$tmp"
  # validate JSON before commit
  if ! jq empty < "$tmp" 2>/dev/null; then
    rm -f "$tmp"
    mumei_log_error "invalid JSON for state.json (feature=${feature})"
    return 1
  fi
  mv "$tmp" "$sf"
}

# state.json の指定 jq path にスカラー値を set する (atomic)。
# 例: mumei_state_set "REQ-1-user-auth" '.phase' '"review"'
# 第3引数は JSON 値 (文字列なら自分でクォートする必要あり)。
mumei_state_set() {
  local feature="$1"
  local jq_path="$2"
  local json_value="$3"
  local sf
  sf="$(mumei_state_path "$feature")"
  [[ -f "$sf" ]] || { mumei_log_error "state.json not found for ${feature}"; return 1; }
  jq "$jq_path = $json_value | .updated_at = (now | todateiso8601)" "$sf" \
    | mumei_state_write_full "$feature"
}

# 現在 phase を返す (plan / implement / review / done)。
mumei_state_phase() {
  local feature="$1"
  mumei_state_get "$feature" '.phase'
}

# requirements / design / tasks の approval 状態を返す (draft / approved)。
mumei_state_approval() {
  local feature="$1"
  local key="$2"  # requirements | design | tasks
  mumei_state_get "$feature" ".approvals.${key}"
}

# state.json の初期化。既存ならスキップ。
mumei_state_init() {
  local feature="$1"
  local slug="$2"
  local id="$3"
  local sf
  sf="$(mumei_state_path "$feature")"
  [[ -f "$sf" ]] && return 0
  local now
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n \
    --arg id "$id" \
    --arg slug "$slug" \
    --arg now "$now" \
    '{
      id: $id,
      slug: $slug,
      phase: "plan",
      approvals: { requirements: "draft", design: "draft", tasks: "draft" },
      current_wave: 0,
      created_at: $now,
      updated_at: $now
    }' | mumei_state_write_full "$feature"
}
