#!/usr/bin/env bats
# Tests for scripts/lint-workflow-lock-paths.sh — issue #197.
#
# The class under test is a workflow that references a dependency lock by a path
# that is not there. Two of the three reference sites fail loudly (pip exits 1 on
# a missing -r file); the semgrep one does not — an absent lock is how an adopter
# who never vendored it looks, so the workflow warns, sets semgrep_available=false
# and carries on green. In THIS repository an absent lock means a typo, and the
# typo therefore disables a detector with nothing red to show for it.
#
# Every test below drives the real script against a synthetic repo, including the
# failure paths: a fail-closed branch that no test triggers is a claim, not a gate.

bats_require_minimum_version 1.5.0

load '../test_helper'

# A repo with one workflow referencing one tracked lock — the healthy baseline.
_init_repo() {
  git init -q -b main
  git config user.email t@t.t
  git config user.name t
  mkdir -p .github/workflows .github-deps/validate
  printf 'jsonschema==4.26.0\n' >.github-deps/validate/requirements.txt
  cat >.github/workflows/validate.yml <<'YAML'
name: validate
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: |
          python3 -m pip install --require-hashes -r .github-deps/validate/requirements.txt
YAML
}

_run_lint() {
  run --separate-stderr bash "${CLAUDE_PLUGIN_ROOT}/scripts/lint-workflow-lock-paths.sh"
}

@test "every referenced lock is a tracked file -> exit 0" {
  _init_repo
  git add -A

  _run_lint
  [ "$status" -eq 0 ]
  [[ "$output" == *"1 workflow-referenced locks are tracked files"* ]]
}

@test "mistyped lock path -> exit 1 (the #194 near-miss)" {
  _init_repo
  # One character wrong, exactly the kind a directory rename produces.
  cat >.github/workflows/validate.yml <<'YAML'
name: validate
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: |
          python3 -m pip install --require-hashes -r .github-deps/validat/requirements.txt
YAML
  git add -A

  _run_lint
  [ "$status" -eq 1 ]
  [[ "$stderr" == *".github-deps/validat/requirements.txt"* ]]
}

@test "soft-fail path: a semgrep_lock= that does not exist -> exit 1" {
  _init_repo
  # This is the reference site that does NOT fail loudly at runtime: the workflow
  # treats an absent lock as "adopter has not vendored it" and skips the detector.
  cat >.github/workflows/review.yml <<'YAML'
name: review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - run: |
          semgrep_lock=".github-deps/semgrep-review/requirements.txt"
          if [ -f "$semgrep_lock" ]; then
            python -m pip install --require-hashes -r "$semgrep_lock"
          else
            echo "::warning::semgrep grounding is NOT RUN"
          fi
YAML
  git add -A

  _run_lint
  [ "$status" -eq 1 ]
  [[ "$stderr" == *".github-deps/semgrep-review/requirements.txt"* ]]
  [[ "$stderr" == *"not run"* ]]
}

@test "lock exists on disk but is untracked -> exit 1 (green locally, dead in CI)" {
  _init_repo
  git add -A
  # Present in the author's working tree, absent from a fresh CI checkout. `[[ -f ]]`
  # would pass this; git ls-files is what makes the check mean anything.
  mkdir -p .github-deps/ghost
  printf 'requests==2.34.2\n' >.github-deps/ghost/requirements.txt
  cat >.github/workflows/validate.yml <<'YAML'
name: validate
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: |
          python3 -m pip install --require-hashes -r .github-deps/ghost/requirements.txt
YAML
  git add .github/workflows/validate.yml

  _run_lint
  [ "$status" -eq 1 ]
  [[ "$stderr" == *".github-deps/ghost/requirements.txt"* ]]
}

@test "matching nothing is a failure, not a pass (the lint must not go blind)" {
  _init_repo
  # The locks are gone and so is every reference to them. A lint that reports
  # success here would be checking zero paths while sounding like it checked all
  # of them — the same absent-reads-as-clean bug it exists to catch.
  rm -rf .github-deps
  cat >.github/workflows/validate.yml <<'YAML'
name: validate
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: echo no locks here
YAML
  git add -A

  _run_lint
  [ "$status" -eq 1 ]
  [[ "$stderr" == *"gone blind"* ]]
}

@test "a .yaml workflow is scanned too -> exit 1 (the extension must not blind it)" {
  _init_repo
  # GitHub Actions honours both extensions. Scanning only *.yml would skip this
  # file's references — and because validate.yml still matches, the gone-blind
  # guard would stay quiet. That is this lint's own bug, one layer up.
  cat >.github/workflows/extra.yaml <<'YAML'
name: extra
on: [pull_request]
jobs:
  extra:
    runs-on: ubuntu-latest
    steps:
      - run: |
          python3 -m pip install --require-hashes -r .github-deps/typo/requirements.txt
YAML
  git add -A

  _run_lint
  [ "$status" -eq 1 ]
  [[ "$stderr" == *".github-deps/typo/requirements.txt"* ]]
}

@test "a single-segment lock path is checked, not skipped -> exit 1" {
  _init_repo
  # `deps/requirements.txt` has one directory segment. Requiring two would skip
  # it in silence while the deeper paths kept the match set non-empty.
  cat >.github/workflows/validate.yml <<'YAML'
name: validate
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: |
          python3 -m pip install --require-hashes -r deps/requirements.txt
YAML
  git add -A

  _run_lint
  [ "$status" -eq 1 ]
  [[ "$stderr" == *"deps/requirements.txt"* ]]
}

@test "a path named only in a comment is prose, not a reference -> exit 0" {
  _init_repo
  cat >>.github/workflows/validate.yml <<'YAML'
      # historical note: this used to live at .github/requirements/old/requirements.txt
YAML
  git add -A

  _run_lint
  [ "$status" -eq 0 ]
}

@test "a bare filename in prompt prose is not a path -> exit 0" {
  _init_repo
  # review-reusable.yml's Claude prompt says "pip `requirements.txt` with hashes"
  # as English, inside a YAML block scalar — not a comment, and not a path.
  cat >>.github/workflows/validate.yml <<'YAML'
      - run: |
          cat <<'PROMPT'
          Lockfiles: pip requirements.txt with hashes, go.mod for Go modules.
          PROMPT
YAML
  git add -A

  _run_lint
  [ "$status" -eq 0 ]
}
