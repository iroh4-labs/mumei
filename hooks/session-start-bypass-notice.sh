#!/usr/bin/env bash
# --- X6: SessionStart — announce that MUMEI_BYPASS is on (advisory) ---
#
# Every other hook sources _lib/anchor.sh, which exits 0 the moment
# MUMEI_BYPASS=1 is seen: the bypass is designed to look like the hook never
# fired. This one deliberately does not, and it is the only hook that must not.
#
# The silence was written for an operator who sets MUMEI_BYPASS themselves, in
# the environment of a session they started on purpose. It does not survive the
# other way the variable can arrive: `env` in .claude/settings.json (or
# settings.local.json, which is gitignored and therefore invisible in any diff)
# reaches hook processes — measured. An agent that writes one line there turns
# every gate off, permanently, with nothing to see. S3 refuses the obvious write;
# it cannot refuse every write. So the state itself is announced instead.
#
# A harness that is off must say it is off. The operator who set it will not be
# surprised; the operator who did not set it is the entire point.
#
# Runs on startup / resume. Silent when the bypass is not active.

set -u

if [[ "${MUMEI_BYPASS:-0}" != "1" ]]; then
  exit 0
fi

printf '[mumei] MUMEI_BYPASS=1 — every gate is disabled for this session (phase, Wave, commit, push, review, golden, memory).\n' >&2

jq -n --arg c "mumei is BYPASSED for this session: MUMEI_BYPASS=1 is set, so every hook exits without enforcing anything — no phase gate, no Wave gate, no commit or push gate, no review gate, no golden-path protection, no memory protection. If you did not set this yourself, check the 'env' block in .claude/settings.json and .claude/settings.local.json (the latter is gitignored, so a change there shows up in no diff). Tell the user before doing anything else." \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $c}}'

exit 0
