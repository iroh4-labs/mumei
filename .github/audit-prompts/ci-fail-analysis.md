# CI Failure Analyzer

Triggered by `workflow_run` after the `ci` workflow concludes with status
`failure`. Analyze the failure and post a helpful comment.

## Step 1 — Gather context

Inputs (provided as env vars):

- `RUN_ID`: the failed run id
- `RUN_URL`: html url to the failed run
- `HEAD_BRANCH`: head branch of the failed run
- `HEAD_SHA`: head sha
- `PR_NUMBER`: PR number if the run was PR-triggered, else empty

Fetch the failed log:

    gh run view "${RUN_ID}" --log-failed > /tmp/log.txt
    head -c 200000 /tmp/log.txt > /tmp/log-trimmed.txt

(Trim to keep the prompt context bounded.)

If the log fetch returns nothing useful (e.g., job was cancelled or runner
crashed), post a short comment "Run failed but no useful log captured;
inspect ${RUN_URL} manually" and exit 0.

## Step 2 — Identify failing job and step

Parse the log for:

- Job name (lint / lint-extra / bats)
- Step name (the name from ci.yml)
- First error line(s)

## Step 3 — Categorize the error

Match against these known categories. If multiple, report the first.

| Pattern                         | Category     | What to suggest                                    |
| ------------------------------- | ------------ | -------------------------------------------------- |
| `^.*: SC\d+:`                   | shellcheck   | quote the variable, follow the link in the message |
| `bash -n.*FAIL:`                | bash syntax  | identify mismatched bracket / quote                |
| `Non-prefixed function`         | mumei prefix | rename to `mumei_<n>` or `_mumei_<n>`              |
| `parse error: ` (jq)            | JSON syntax  | fix the offending region                           |
| `FAIL: .* missing field:`       | frontmatter  | add the missing required key                       |
| `forbidden plugin-agent field:` | frontmatter  | remove `hooks` / `mcpServers` / `permissionMode`   |
| `shfmt -d` diff output          | shfmt        | run `shfmt -w -i 2 <file>` to auto-format          |
| `MD\d+/`                        | markdownlint | fix per the cited rule                             |
| `typos:`                        | typo         | apply the suggested replacement                    |
| `lychee:`                       | broken link  | update or remove                                   |
| `not ok` / `assertion failed`   | bats         | name the failing test and failed assertion         |
| `semgrep`                       | SAST         | review the rule and the matched code               |
| `shellharden`                   | quoting      | apply `${var}` quoting                             |

For categories not in the table, fall back to "unknown — pasting first 30
lines of relevant log".

## Step 4 — Compose the report

If `PR_NUMBER` is set:

    gh pr comment "${PR_NUMBER}" --body-file <path>

Else (push to main):

    gh issue create --title "<title>" --label ci-fail --body-file <path>

Body shape:

    ## CI Failure Analysis — run #<run number>

    **Failing job**: <job name>
    **Failing step**: <step name>
    **Category**: <category from table>

    ### Root cause

    <one paragraph; quote the offending line>

    ### Suggested fix

    <concrete patch or command>

    ### Reproduce locally

    ```
    <single command>
    ```

    ---

    Run: ${RUN_URL}
    Commit: ${HEAD_SHA}

## Step 5 — Exit

Always exit 0 (this analyzer is informational; it must not affect any other
workflow).

## What NOT to do

- Do not retry the failed job.
- Do not propose changes that touch unrelated files.
- Do not duplicate a comment if a prior `CI Failure Analysis` comment already
  exists for the same run id (check with `gh pr view --json comments`).
- Do not include the entire log in the comment; trim to the relevant 20 lines.
