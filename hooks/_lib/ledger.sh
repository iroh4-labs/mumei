#!/usr/bin/env bash
# Cross-feature finding ledger (pillar C — REQ-22.7 / REQ-22.8 / REQ-22.9).
#
# Records every validated finding with a move-resistant fingerprint so the
# review pipeline can annotate the issue-validator when a finding matches a
# fingerprint that was previously judged a false positive. The ledger is an
# annotation source ONLY — it never auto-suppresses a finding, and a
# HIGH/CRITICAL finding is always surfaced regardless of prior FP marks.
#
# Single-writer by design: the orchestrator appends from Phase 5 Stage 6 /
# /mumei:review (sequentially, after validation). The issue-validator is
# read-only and never touches this file. The mkdir mutex (mirroring
# memory.sh) only guards two concurrent mumei sessions reviewing different
# features into the same project ledger.
#
# Dependencies: jq, shasum.

set -u

if ! declare -F mumei_log_info >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source "$(dirname "${BASH_SOURCE[0]}")/log.sh"
fi

# Path to the cross-feature ledger. Override with MUMEI_LEDGER_PATH (tests).
mumei_ledger_path() {
  printf '%s' "${MUMEI_LEDGER_PATH:-.mumei/finding-ledger.jsonl}"
}

# Compute a move-resistant fingerprint for a finding JSON.
#   <category>:<basename-of-location-path>:<symbol>
# Line numbers are stripped from `location` so the fingerprint survives code
# movement. `symbol` is the finding's optional `.symbol` (an enclosing
# function/class hint a reviewer may emit); when absent it falls back to a
# short hash of the normalized trace+evidence — stable across line shifts
# (the code text is unchanged) but sensitive to code edits, matching the
# SARIF partialFingerprints / Semgrep match_based_id philosophy.
# Arg: $1 finding_json. Echoes the fingerprint string.
mumei_ledger_fingerprint() {
  local finding="$1"
  local category path base symbol
  category="$(jq -r '.category // "uncategorized"' <<<"$finding" 2>/dev/null || printf 'uncategorized')"
  path="$(jq -r '(.location // "") | split(":")[0]' <<<"$finding" 2>/dev/null || printf '')"
  base="$(basename "${path:-unknown}")"
  [[ -n "$base" ]] || base="unknown"
  symbol="$(jq -r '.symbol // empty' <<<"$finding" 2>/dev/null || printf '')"
  if [[ -z "$symbol" ]]; then
    local blob
    blob="$(jq -r '((.trace // "") + " " + (.evidence // "")) | gsub("[[:space:]]+";" ") | ascii_downcase | ltrimstr(" ") | rtrimstr(" ")' <<<"$finding" 2>/dev/null || printf '')"
    if [[ -n "$blob" ]]; then
      symbol="h$(printf '%s' "$blob" | shasum -a 256 | cut -c1-8)"
    else
      symbol="nosym"
    fi
  fi
  printf '%s:%s:%s' "$category" "$base" "$symbol"
}

# Append a ledger entry for a validated finding.
# Args: $1 finding_json  $2 feature  $3 reviewer  $4 decision  $5 severity
# decision is the validator verdict (valid / invalid / unsure /
# valid_by_assertion); decision=invalid is what marks a fingerprint as a
# past false positive. Returns 0 on success, 1 on failure.
mumei_ledger_append() {
  local finding="$1" feature="$2" reviewer="$3" decision="$4" severity="$5"
  local ledger fp entry lockdir tries=0
  ledger="$(mumei_ledger_path)"
  fp="$(mumei_ledger_fingerprint "$finding")"
  mkdir -p "$(dirname "$ledger")" 2>/dev/null || true

  entry="$(jq -nc \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg feature "$feature" \
    --arg fp "$fp" \
    --arg reviewer "$reviewer" \
    --arg decision "$decision" \
    --arg severity "$severity" \
    '{ts:$ts, feature:$feature, fingerprint:$fp, reviewer:$reviewer, decision:$decision, severity:$severity}')" || {
    mumei_log_error "ledger: failed to build entry"
    return 1
  }

  lockdir="${ledger}.mkdirlock"
  while ! mkdir "$lockdir" 2>/dev/null; do
    tries=$((tries + 1))
    if ((tries > 50)); then
      mumei_log_warn "ledger: mkdir-lock timeout; appending without lock (single-line append is atomic < PIPE_BUF)"
      break
    fi
    sleep 0.1
  done
  printf '%s\n' "$entry" >>"$ledger"
  local rc=$?
  rmdir "$lockdir" 2>/dev/null || true
  return "$rc"
}

# Count prior false-positive marks for a fingerprint.
# A fingerprint is a past FP when an earlier ledger entry recorded
# decision=invalid for it. Echoes the integer count (0 when the ledger is
# absent or no match). Used to build the validator FP annotation.
# Arg: $1 fingerprint.
mumei_ledger_prior_fp_count() {
  local fp="$1" ledger
  ledger="$(mumei_ledger_path)"
  [[ -f "$ledger" ]] || {
    printf '0'
    return 0
  }
  jq -r --arg fp "$fp" -s \
    '[.[] | select(.fingerprint == $fp and .decision == "invalid")] | length' \
    "$ledger" 2>/dev/null || printf '0'
}
