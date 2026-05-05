# Privacy Policy

mumei is a Claude Code plugin that runs entirely on the user's local machine.

## Data collection

mumei collects, transmits, and stores no user data. No telemetry, no analytics, no error reporting. All state is project-local under `.mumei/`; nothing is written to `~/.claude/` or any global location.

## Network egress

mumei itself initiates no outbound requests.

## Third-party detectors

When invoked, `semgrep` runs locally (no network). `osv-scanner` queries `https://osv.dev/` for CVE data. mumei does not control these tools' privacy behavior; see each tool's own policy.

## Contact

Open an issue: https://github.com/hir4ta/mumei/issues
