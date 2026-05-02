#!/usr/bin/env bash
# tasks.md の parse 関数。Wave > Task の階層、_Files:_ / _Depends:_ / _Requirements:_ メタを抽出。
# BSD awk (macOS デフォルト) と GNU awk の両方で動作するよう、3 引数 match() を使わず
# 2 引数 match() + RSTART/RLENGTH + substr() で書く。
# 依存: grep, awk (BSD/GNU), sed

set -u

if ! declare -F mumei_log_info >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/log.sh"
fi

# tasks.md パス。
mumei_tasks_path() {
  local feature="$1"
  printf '%s' ".mumei/specs/${feature}/tasks.md"
}

# tasks.md の存在確認。
mumei_tasks_exists() {
  local feature="$1"
  [[ -f "$(mumei_tasks_path "$feature")" ]]
}

# 全 task ID を一覧 (例: 1.1 1.2 2.1)。
# tasks.md のチェックボックス行 `- [ ] N.M ...` または `- [x] N.M ...` から抽出。
mumei_tasks_list_ids() {
  local feature="$1"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  grep -E '^- \[[x ]\] [0-9]+(\.[0-9]+)*' "$tf" \
    | sed -E 's/^- \[[x ]\] ([0-9]+(\.[0-9]+)*).*/\1/'
}

# 指定 task ID の status を返す ("complete" / "incomplete")。見つからない場合 exit 1。
mumei_tasks_status() {
  local feature="$1"
  local task_id="$2"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  local line
  line="$(grep -E "^- \[[x ]\] ${task_id}([^0-9.]|\$)" "$tf" | head -n1)"
  [[ -n "$line" ]] || return 1
  # case 文で portable に判定 (bash/zsh/sh いずれでも動作)
  case "$line" in
    '- [x] '*) printf 'complete' ;;
    *)         printf 'incomplete' ;;
  esac
}

# 内部 helper: awk で task block 内の特定 meta (_Files:_ / _Depends:_ / _Requirements:_) を抽出。
# BSD awk 互換。3 引数 match は使わない。
_mumei_tasks_extract_meta() {
  local task_id="$1"
  local meta_key="$2"  # Files | Depends | Requirements
  local tasks_file="$3"
  awk -v target_id="$task_id" -v key="$meta_key" '
    function task_id_of(line,    s, id) {
      # line 例: "- [ ] 1.2 description"
      # 先頭の "- [x] " or "- [ ] " を剥ぐ
      s = line
      sub(/^- \[[x ]\] /, "", s)
      # 残りの先頭が ID
      if (match(s, /^[0-9]+(\.[0-9]+)*/)) {
        id = substr(s, RSTART, RLENGTH)
        return id
      }
      return ""
    }
    BEGIN { in_block = 0; meta_pat = "^[[:space:]]+- _" key ":[[:space:]]*" }
    /^- \[[x ]\] / {
      tid = task_id_of($0)
      if (tid == target_id) {
        in_block = 1
        next
      } else if (in_block) {
        # 次の task に到達したら終了
        exit
      }
      next
    }
    in_block {
      if ($0 ~ meta_pat) {
        s = $0
        sub(meta_pat, "", s)
        # 末尾の "_" と空白を剥ぐ
        sub(/_[[:space:]]*$/, "", s)
        print s
        exit
      }
    }
  ' "$tasks_file"
}

# 指定 task ID の `_Files:_` メタを取得 (カンマ区切りファイルパス)。
mumei_tasks_files() {
  local feature="$1"
  local task_id="$2"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  _mumei_tasks_extract_meta "$task_id" "Files" "$tf"
}

# 指定 task ID の `_Depends:_` メタを取得 (カンマ区切り task ID、なしは "-")。
mumei_tasks_depends() {
  local feature="$1"
  local task_id="$2"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  _mumei_tasks_extract_meta "$task_id" "Depends" "$tf"
}

# 指定 task ID の `_Requirements:_` メタを取得 (カンマ区切り REQ-X.Y)。
mumei_tasks_requirements() {
  local feature="$1"
  local task_id="$2"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  _mumei_tasks_extract_meta "$task_id" "Requirements" "$tf"
}

# 指定ファイルパスがどの task に属するか返す (複数ヒットありうる、空白区切り)。
# scope creep 検出 (I2) と編集対象の task 逆引き (I1) に使う。
mumei_tasks_owners_of_file() {
  local feature="$1"
  local file_path="$2"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  local owners=""
  local saved_ifs="$IFS"
  while IFS= read -r task_id; do
    [[ -n "$task_id" ]] || continue
    local files
    files="$(mumei_tasks_files "$feature" "$task_id" 2>/dev/null || true)"
    if [[ -n "$files" ]]; then
      IFS=',' read -ra arr <<< "$files"
      for f in "${arr[@]}"; do
        local trimmed
        trimmed="$(echo "$f" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
        if [[ "$trimmed" == "$file_path" ]]; then
          owners+="${task_id} "
        fi
      done
    fi
  done < <(mumei_tasks_list_ids "$feature")
  IFS="$saved_ifs"
  printf '%s' "${owners% }"
}

# 現在の Wave (= 全 task が complete でない最小の Wave 番号) を返す。
# Wave ヘッダは `## Wave N: ...` 形式。
# BSD awk 互換: 2 引数 match + RSTART/RLENGTH + substr。
# 注意: awk の exit は END pattern を実行するため、printed フラグで重複出力を防ぐ。
mumei_tasks_current_wave() {
  local feature="$1"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  awk '
    function wave_num_of(line,    s, n) {
      s = line
      if (match(s, /^## Wave [0-9]+:/)) {
        s = substr(s, RSTART, RLENGTH)
        sub(/^## Wave /, "", s)
        sub(/:$/, "", s)
        return s
      }
      return ""
    }
    BEGIN { last_wave_num = ""; last_wave_complete = 1; printed = 0 }
    /^## Wave [0-9]+:/ {
      if (last_wave_num != "" && last_wave_complete == 0) {
        print last_wave_num
        printed = 1
        exit
      }
      last_wave_num = wave_num_of($0)
      last_wave_complete = 1
      next
    }
    /^- \[ \] / { last_wave_complete = 0 }
    END {
      if (!printed && last_wave_num != "" && last_wave_complete == 0) print last_wave_num
    }
  ' "$tf"
}

# 指定 Wave の全 task が complete か判定 (exit 0 = complete, exit 1 = incomplete)。
mumei_tasks_wave_complete() {
  local feature="$1"
  local wave="$2"
  local tf
  tf="$(mumei_tasks_path "$feature")"
  [[ -f "$tf" ]] || return 1
  awk -v target_wave="$wave" '
    function wave_num_of(line,    s) {
      s = line
      if (match(s, /^## Wave [0-9]+:/)) {
        s = substr(s, RSTART, RLENGTH)
        sub(/^## Wave /, "", s)
        sub(/:$/, "", s)
        return s
      }
      return ""
    }
    BEGIN { in_wave = 0; incomplete = 0 }
    /^## Wave [0-9]+:/ {
      n = wave_num_of($0)
      if (n == target_wave) { in_wave = 1; next }
      if (in_wave) { exit }
      next
    }
    in_wave && /^- \[ \] / { incomplete++ }
    END { exit (incomplete > 0 ? 1 : 0) }
  ' "$tf"
}
