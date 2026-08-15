---
name: authstate
description: Logs in once with a test account and keeps a shared Playwright storageState cookie jar on disk, so browser tools get a signed-in session without ever seeing a password. Use when a page, capture, scrape or test needs to be logged in, when a screenshot came back on a login screen, or when a run redirected to sign-in. Use when the user says "log in first", "authenticated screenshot", "signed-in session", "get me a cookie jar", "storageState", "session expired", "reuse the login", "use the test account", or mentions `.testing-credentials.yaml`. Use before handing cookies to `browsershot`, Playwright or any Chromium tool. Do not script a login by hand and never put a password in a command.
license: MIT
compatibility: needs the `authstate` CLI and `jq` on PATH, plus Playwright Chromium and a `.testing-credentials.yaml` file in the repo
metadata:
  author: Fayez Nazzal
  version: "0.3.1"
---

# authstate

Gives you a Playwright `storageState` jar for a test account, so any browser tool can run signed in.

## When to use

- A capture, scrape or test needs an authenticated page.
- A screenshot or run landed on a login or sign-in screen.
- You are about to pass `--cookies` or `--storage-state` to a browser tool.
- You need two independent sessions on the same account.
- The repo has a `.testing-credentials.yaml` file.

## Check first

```bash
command -v authstate && command -v jq && ls .testing-credentials.yaml
```

- Missing `authstate` or `jq` means stop and tell the user.
- Missing `.testing-credentials.yaml` means stop and ask the user for it.
- Every entry needs a `signed_in_when` block. Without it a run refuses with reason `assertion-missing` and exit code `3`.

## Core recipe

```bash
out=$(authstate ensure --credentials .testing-credentials.yaml 2>/dev/null)
code=$?
jar=$(echo "$out" | jq -r .path)
if [ "$code" = "0" ] && [ "$jar" != "null" ]; then
  browsershot "http://localhost:3000/dashboard" --cookies "$jar"
fi
```

- Assert `exit_code` is `0` and `ok` is `true` before using `$jar`.
- Guard on `[ "$jar" != "null" ]`, since a refusal sets `path` to `null`.
- Any Playwright tool takes the same file, as in `npx playwright test --storage-state "$jar"`.
- For a second session on one account add `--namespace slot-a`.
- For the jar location with no network use `authstate path`.

## Reading the result

- `ensure`, `login` and `path` print exactly one JSON line on stdout. Everything else goes to stderr.
- `revoke` and `prune` print no JSON and exit `0`.
- Fields worth reading are `ok`, `exit_code`, `status`, `reason`, `path`, `browser_launched` and `verified`.
- `status` is one of `reused`, `refreshed`, `logged-in`, `refused`.
- Failures caught before the run starts, such as a missing file or a bad flag, print one stderr line and no JSON.

Exit codes.

| code | meaning | do |
| ---- | ---- | ---- |
| `0` | usable | read `.path` and carry on |
| `1` | credentials rejected | stop and tell the user |
| `2` | usage error | fix your command line |
| `3` | file invalid or `signed_in_when` missing | stop and tell the user to fix the file |
| `4` | no match or ambiguous match | fix `--purpose` |
| `5` | lock timeout | retry once |
| `6` | human step required | ask the user to run `authstate login --headed` |
| `7` | tool could not run | check the app and the browser are up |

## Rules

- Never put a password in a command, a script or a prompt. It lives in `.testing-credentials.yaml`.
- Never run `authstate login` yourself. It opens a window and waits for a human. Ask the user.
- Always pipe stdout through `jq -r .path`. Raw stdout is a JSON envelope, not a filename.
- Never print jar contents, a cookie or a token. Pass the path along instead.
- Prefer `ensure` over `--force`, and use `--namespace` rather than `--out`, which was removed and now exits `2`.
- Never branch on the `command` field. It reads `ensure` even after a `login`.

Full recipes and pitfalls live in `AGENTS.md` in this repo.
