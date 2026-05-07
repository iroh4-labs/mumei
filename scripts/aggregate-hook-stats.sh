#!/usr/bin/env bash
# Aggregate the hook decision log written by hooks/_lib/hook-stats.sh
# (REQ-11.13). Reads .mumei/.hook-stats.jsonl and pivots by Hook ID.
#
# Usage:
#   bash scripts/aggregate-hook-stats.sh
#   bash scripts/aggregate-hook-stats.sh -f path/to/hook-stats.jsonl

set -u

log=".mumei/.hook-stats.jsonl"

case "${1:-}" in
-f)
  log="${2:-}"
  if [[ -z "$log" ]]; then
    echo "aggregate-hook-stats: -f requires a path" >&2
    exit 1
  fi
  ;;
esac

if [[ ! -f "$log" ]]; then
  echo "aggregate-hook-stats: no log file at ${log}" >&2
  exit 0
fi

_mumei_pad() {
  if command -v column >/dev/null 2>&1; then
    column -t -s $'\t'
  else
    cat
  fi
}

# Pivot: hook_id × decision → count.
{
  printf 'hook_id\tdecision\tcount\n'
  jq -sr '
    group_by([.hook_id, .decision])[]
    | {hook_id: .[0].hook_id, decision: .[0].decision, count: length}
    | "\(.hook_id)\t\(.decision)\t\(.count)"
  ' "$log" | sort
} | _mumei_pad

total="$(grep -c '' "$log" 2>/dev/null || echo 0)"
echo
echo "## totals"
echo "  records: ${total}"
deny="$(jq -sr '[.[] | select(.decision == "deny")] | length' "$log" 2>/dev/null || echo 0)"
warn="$(jq -sr '[.[] | select(.decision == "warn")] | length' "$log" 2>/dev/null || echo 0)"
pass="$(jq -sr '[.[] | select(.decision == "pass")] | length' "$log" 2>/dev/null || echo 0)"
echo "  deny: ${deny}"
echo "  warn: ${warn}"
echo "  pass: ${pass}"

exit 0
