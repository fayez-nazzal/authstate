# AGENTS.md

`authstate` is the one tool that holds a password. An agent calls it to get a Playwright `storageState` jar for a test account, then hands that jar path to any browser tool that needs to be signed in. The reason to call it instead of scripting a login yourself is the jar. It is one file per account on disk, safe to read by many tools at once, and a fresh jar is reused with no browser launch at all, so the password never travels through your context or through another tool.

Read `README.md` for what every flag means. This file is about order, recipes and traps.

## Golden rules

- Never put a password in a command, a script or a prompt. Put it in `.testing-credentials.yaml` and let `authstate` read it.
- Never run `authstate login`. It opens a visible browser window and waits for a human. Ask the user to run it.
- Always pipe stdout through `jq`. Every run prints one JSON line, so `authstate path ... | jq -r .path` is the only correct way to get a path.
- Never treat raw stdout as a path. It is JSON, not a filename.
- Read the exit code before you read anything else. Branch on it.
- Send the human report away when you do not need it. It goes to stderr, so `2>/dev/null` keeps your context clean.
- Pull one field, not the whole envelope, when that is all you need. `jq -r .exit_code` is cheaper than the full line.
- Never print a jar file into your context. It holds live cookies. Pass the path along instead.
- Prefer `ensure` over `--force`. `ensure` reuses a live jar and opens no browser.
- Use `--namespace` when you need a second session on the same account. `--out` was removed and now fails with exit code `2`.
- Give the credentials file a `signed_in_when` block on every entry. Without it a run refuses with reason `assertion-missing` and exit code `3`.

## Recipes

### 1. Get a jar path without touching the network

Proves the jar location for an account, with no browser and no login.

```bash
jar=$(authstate path --credentials .testing-credentials.yaml 2>/dev/null | jq -r .path)
echo "$jar"
```

Real run:

```
/Users/macbook/.authstate/demo-app--basic-user.json
```

Ran it. `path` never fails on the network because it never opens one.

### 2. Guarantee a signed-in jar, then check the verdict

Proves the account is usable right now, and tells you why if it is not.

```bash
out=$(authstate ensure --credentials .testing-credentials.yaml 2>/dev/null)
code=$?
echo "$out" | jq -r '{ok, status, reason, path, exit_code}'
```

Real run against an app that is not listening:

```json
{"tool":"authstate","version":"0.2.1","command":"ensure","ok":false,"status":"refused","reason":"browser-unavailable","app":"demo-app","account":"basic-user","namespace":null,"path":null,"expires_at":null,"seconds_remaining":null,"expiry_source":"none","logged_in":null,"proof":null,"verified":false,"browser_launched":true,"exit_code":7}
```

Ran it. The exit code was `7`.

### 3. Hand the jar to a browser tool

Proves an authenticated capture end to end. This is the main reason `authstate` exists.

```bash
jar=$(authstate ensure --credentials .testing-credentials.yaml 2>/dev/null | jq -r .path)
if [ -n "$jar" ] && [ "$jar" != "null" ]; then
  browsershot "http://localhost:3000/dashboard" --cookies "$jar"
fi
```

Any Playwright based tool works the same way, since the jar is a plain `storageState` file.

```bash
npx playwright test --storage-state "$jar"
```

Ran the `authstate` half. The `browsershot` half was not run here because no signed-in app was available in this environment. The `--cookies` flag is real and is listed in `browsershot --help`.

### 4. Two sessions on one account

Proves two independent jars for the same login, so parallel work does not fight over one file.

```bash
slot_a=$(authstate ensure --credentials .testing-credentials.yaml --namespace slot-a 2>/dev/null | jq -r .path)
slot_b=$(authstate ensure --credentials .testing-credentials.yaml --namespace slot-b 2>/dev/null | jq -r .path)
```

Ran the `path` form of this. The jar file name gains the namespace, as in `demo-app--basic-user--slot-a.json`.

## Reading the output

`ensure`, `login` and `path` print exactly one JSON line on stdout. Every other byte goes to stderr.

`revoke` and `prune` print no JSON at all. They only log to stderr and exit `0`.

Assert on these fields.

| field | what to do with it |
| ---- | ---- |
| `ok` | the single boolean gate. `true` means you have a usable jar |
| `exit_code` | matches the process exit code. Branch on it |
| `status` | one of `reused`, `refreshed`, `logged-in`, `refused` |
| `reason` | `null` on success, else a short reason code such as `browser-unavailable` |
| `path` | the jar file. `null` on a refusal, so guard before using it |
| `browser_launched` | `true` when a real browser opened. Useful for spotting slow runs |
| `verified` | `true` only when a browser confirmed the session, not when expiry maths did |

Exit codes, from `src/verdict/exit-code.ts`.

| code | meaning | what an agent should do |
| ---- | ---- | ---- |
| `0` | usable | read `.path` and carry on |
| `1` | credentials rejected | stop. The password is wrong. Tell the user |
| `2` | usage error | fix your own command line |
| `3` | credentials file invalid or `signed_in_when` missing | stop. Tell the user to fix the file |
| `4` | no entry matches, or the match is ambiguous | fix `--purpose` |
| `5` | lock timeout | another run held the lock. Retry once |
| `6` | human step required | stop. Ask the user to run `authstate login --headed` |
| `7` | tool could not run | the app or the browser was unreachable. Check the app is up |

Not every failure prints JSON. Failures caught before the run starts, such as a missing credentials file or a bad flag, print one stderr line and nothing on stdout. Reasons raised during a run, such as `assertion-missing` and `browser-unavailable`, do print the full JSON line.

## Pitfalls

| symptom | cause | fix |
| ---- | ---- | ---- |
| The path you pass along starts with `{"tool":"authstate"` | stdout is a JSON envelope, never a bare path | pipe through `jq -r .path` |
| Your path variable is the string `null` | the run refused, so `path` is `null` | check `exit_code` first, and guard on `[ "$jar" != "null" ]` |
| The command hangs and nothing happens | you called `authstate login`, which opens a window and waits for a human | use `ensure`. Only a human runs `login` |
| Exit `2` with `--headed is only valid on authstate login` | `--headed` was passed to another command | drop the flag |
| Exit `2` with `--out was removed` | `--out` no longer exists | use `--namespace` |
| Exit `3` with reason `assertion-missing` | the entry has no `signed_in_when` block | add `url_matches`, or `selector`, or both |
| Exit `4` on a purpose you believe is right | `--purpose` matches an entry key or part of the purpose text, nothing else | check the keys in the credentials file |
| Exit `7` and `browser_launched` is `true` | the app at `app_url` is not listening, or the page never loaded | start the app, then retry |
| The JSON says `"command":"ensure"` after you ran `login` | the envelope hardcodes `ensure` for both, see `baseResult` in `src/ensure/ensure-run.ts` | branch on `status` and `exit_code`, never on `command` |
| `prune` deleted jars for an app you did not name | `prune` sweeps every dead jar in `~/.authstate/`, not just the one app | expect it to be global |
| A parallel run sits still for a while | callers collapse into one login through a lock folder beside the jar | let it wait. It gives up with exit `5` |

## Reporting

Tell the user this and nothing more.

- The verdict in plain words, such as "the jar is fresh and reused" or "the login refused because the app was unreachable".
- The jar path, as an absolute path.
- The exit code, when it was not `0`, plus the `reason` field.
- The next human step, when the exit code was `6`.

Never paste the jar contents, a cookie, a token or a password into your reply. Those are live credentials. Paths and verdicts only.
