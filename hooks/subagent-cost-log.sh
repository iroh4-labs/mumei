#!/usr/bin/env bash
# SubagentStop hook (REQ-16): physically enforce cost-log recording for
# the 8 mumei reviewer / validator / curator subagents by reverse-looking
# up the subagent's own transcript jsonl from agent_id and summing every
# assistant entry's usage. The orchestrator's mumei_cost_log_before /
# _after wrap is now optional — this hook is the authoritative record
# path.
#
# Subagent transcript layout (verified 2026-05, see docs/harness-
# engineering.md Part 13):
#   ~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl   (parent)
#   ~/.claude/projects/<encoded-cwd>/<session-uuid>/
#     └── subagents/agent-<agent_id>.jsonl                  (this subagent)
#
# Each subagent invocation gets its own jsonl, so agent_id alone is a
# 1:1 attribution key — no heuristics needed when subagents run in
# parallel.
#
# Failure handling (REQ-16.4): all non-fatal errors emit a single line
# to stderr and exit 0. No placeholder records are written; an absent
# record is more honest than a record with empty usage.
#
# Env knobs:
#   MUMEI_BYPASS=1 — silent exit 0

set -u

if [[ "${MUMEI_BYPASS:-0}" == "1" ]]; then
  exit 0
fi

INPUT="$(cat 2>/dev/null || true)"
[[ -z "$INPUT" ]] && exit 0

AGENT_ID="$(jq -r '.agent_id // empty' <<<"$INPUT" 2>/dev/null || true)"
AGENT_TYPE="$(jq -r '.agent_type // empty' <<<"$INPUT" 2>/dev/null || true)"
TRANSCRIPT_PATH="$(jq -r '.transcript_path // empty' <<<"$INPUT" 2>/dev/null || true)"

# Strip the `mumei:` plugin namespace prefix so the cost-log `agent`
# field matches the short names mumei_cost_log_after uses
# (e.g. "spec-compliance-reviewer").
AGENT_SHORT="${AGENT_TYPE#mumei:}"

# Resolve active feature → cost-log target path. spec vehicle lands
# under .mumei/specs/, plan vehicle under .mumei/plans/.
ACTIVE_FEATURE=""
if [[ -f .mumei/current ]]; then
  ACTIVE_FEATURE="$(tr -d '[:space:]' <.mumei/current 2>/dev/null || true)"
fi

if [[ -z "$ACTIVE_FEATURE" ]]; then
  printf '[mumei] cost-log: no active feature, skipping\n' >&2
  exit 0
fi

COST_LOG=""
if [[ -d ".mumei/specs/${ACTIVE_FEATURE}" ]]; then
  COST_LOG=".mumei/specs/${ACTIVE_FEATURE}/cost-log.jsonl"
elif [[ -d ".mumei/plans/${ACTIVE_FEATURE}" ]]; then
  COST_LOG=".mumei/plans/${ACTIVE_FEATURE}/cost-log.jsonl"
else
  printf '[mumei] cost-log: no active feature, skipping\n' >&2
  exit 0
fi

# Build subagent jsonl path. transcript_path points at the parent
# session's jsonl; the subagent's own jsonl sits next to it under
# <session-uuid>/subagents/agent-<agent_id>.jsonl.
if [[ -z "$AGENT_ID" || -z "$TRANSCRIPT_PATH" ]]; then
  printf '[mumei] cost-log: extraction failed for agent=%s: missing agent_id or transcript_path\n' "${AGENT_SHORT:-?}" >&2
  exit 0
fi

SUB_JSONL="${TRANSCRIPT_PATH%.jsonl}/subagents/agent-${AGENT_ID}.jsonl"
if [[ ! -r "$SUB_JSONL" ]]; then
  printf '[mumei] cost-log: extraction failed for agent=%s: subagent jsonl not readable (%s)\n' \
    "${AGENT_SHORT:-?}" "$SUB_JSONL" >&2
  exit 0
fi

# Sum usage across every assistant entry in the subagent jsonl.
# Subagents run multiple turns; using only the last entry would
# undercount.
USAGE_JSON="$(
  jq -s '
    [.[] | select(.type == "assistant") | .message.usage // {}]
    | reduce .[] as $u ({};
        .input_tokens                = ((.input_tokens // 0)                + ($u.input_tokens // 0)) |
        .output_tokens               = ((.output_tokens // 0)               + ($u.output_tokens // 0)) |
        .cache_read_input_tokens     = ((.cache_read_input_tokens // 0)     + ($u.cache_read_input_tokens // 0)) |
        .cache_creation_input_tokens = ((.cache_creation_input_tokens // 0) + ($u.cache_creation_input_tokens // 0))
      )
  ' <"$SUB_JSONL" 2>/dev/null || true
)"

if [[ -z "$USAGE_JSON" ]] || ! jq -e 'type == "object"' <<<"$USAGE_JSON" >/dev/null 2>&1; then
  printf '[mumei] cost-log: extraction failed for agent=%s: usage parse failed\n' "${AGENT_SHORT:-?}" >&2
  exit 0
fi

# Build the final cost-log record. Token fields are top-level to match
# schemas/cost-log.schema.json (additionalProperties: false), and the
# `with_entries` filter drops any extra usage keys (e.g. service_tier,
# server_tool_use) so the schema stays clean.
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RECORD="$(
  jq -nc \
    --arg ts "$TS" \
    --arg feature "$ACTIVE_FEATURE" \
    --arg agent "$AGENT_SHORT" \
    --argjson usage "$USAGE_JSON" \
    '{ts: $ts, feature: $feature, wave: null, iteration: null, agent: $agent, phase: "after"}
     + ($usage
        | with_entries(select(.key as $k
            | ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]
            | index($k))))' \
    2>/dev/null || true
)"

if [[ -z "$RECORD" ]]; then
  printf '[mumei] cost-log: extraction failed for agent=%s: record build failed\n' "${AGENT_SHORT:-?}" >&2
  exit 0
fi

mkdir -p "$(dirname "$COST_LOG")" 2>/dev/null || true
printf '%s\n' "$RECORD" >>"$COST_LOG" 2>/dev/null || {
  printf '[mumei] cost-log: append failed: %s\n' "$COST_LOG" >&2
  exit 0
}

exit 0
