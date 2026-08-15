# authstate

`authstate` logs in to a web app once and keeps the browser session on disk as a Playwright `storageState` file, so other tools never handle passwords.

Each account gets its own file, called a jar. Tools that share an account share one login. Tools on different accounts never block each other.

It is built to be called by an AI coding agent, not typed by hand. Every run prints one JSON envelope on stdout and sends the human report to stderr, and every outcome maps to a named exit code. Agents should read [`AGENTS.md`](AGENTS.md) for the recipes, the output contract and the traps.

## Requirements

- `bun` version 1.2 or newer.
- Google Chrome, or the Chromium that Playwright downloads.

## Install

```bash
bun install
bun link
```

There is no build step. The `authstate` command runs `src/main.ts` straight from source.

## Configure

Copy the example file and fill in your own values.

```bash
cp .testing-credentials.example.yaml .testing-credentials.yaml
```

The file holds one entry per account.

```yaml
app: example-app
default: basic-user
credentials:
  basic-user:
    purpose: basic plan account for smoke tests
    email: basic-user@example.com
    password: replace-me
    app_url: http://localhost:3000
    signed_in_when:
      url_matches: "http://localhost:3000/dashboard/**"
```

- `app` names the jar. It falls back to the folder holding the file.
- `default` picks the entry used when no `--purpose` is passed.
- `purpose` is free text. `--purpose` matches an entry key or any part of it.
- `email`, `password` and `app_url` are required on every entry.
- `signed_in_when` needs `url_matches`, or `selector`, or both. Without it a login refuses with exit code `3`.

## The smallest useful command

```bash
authstate ensure --credentials .testing-credentials.yaml
```

That makes sure a valid jar exists and prints one JSON line on stdout.

## Commands

- `ensure` reuses a jar the expiry maths has not proven dead, else runs one headless login.
- `login` always opens a visible browser and writes the resulting jar. Use it when the account needs a code or a single sign on step.
- `path` prints where the jar lives without touching the network.
- `revoke` deletes one account's jar and its lock.
- `prune` deletes every dead jar in `~/.authstate/`.

```bash
authstate ensure --credentials .testing-credentials.yaml --purpose premium-user
authstate ensure --credentials .testing-credentials.yaml --force
authstate login  --credentials .testing-credentials.yaml --headed
authstate path   --credentials .testing-credentials.yaml
authstate revoke --credentials .testing-credentials.yaml --purpose premium-user
authstate prune  --credentials .testing-credentials.yaml
```

Feed the jar path into another tool. The `path` field of the JSON line carries it.

```bash
STATE=$(authstate path --credentials .testing-credentials.yaml | jq -r .path)
some-browser-tool --storage-state "$STATE"
```

## Flags

- `--credentials <path>` the credentials file. Required.
- `--purpose <name>` which entry to use.
- `--namespace <name>` a second separate session on the same account.
- `--force` skip the freshness check and log in now.
- `--verify` open a browser to confirm a jar the expiry maths already calls fresh.
- `--headed` accepted only on `authstate login`. That command opens a window anyway.
- `--timeout <ms>` per step timeout. Default `20000`.
- `-h`, `--help` print the help text and exit `0`.

`--out` was removed. It let a live credential land anywhere and broke the one-jar-per-account rule. Passing it now fails with exit code `2`. Use `--namespace` instead.

## Exit codes

| code | meaning |
| ---- | ------- |
| 0 | usable |
| 1 | credentials rejected |
| 2 | usage error |
| 3 | credentials file invalid or assertion missing |
| 4 | no entry matches / ambiguous |
| 5 | lock timeout |
| 6 | human step required |
| 7 | tool could not run |

A browser that cannot start, or an `app_url` with nothing listening, is a `browser-unavailable` refusal. It still prints one JSON line and exits `7`.

## JSON output

`ensure`, `login` and `path` print one JSON line on stdout. Progress and errors go to stderr, so stdout stays clean.

```json
{"tool":"authstate","version":"0.2.1","command":"path","ok":true,"status":"reused","reason":null,"app":"example-app","account":"basic-user","namespace":null,"path":"/Users/you/.authstate/example-app--basic-user.json","expires_at":null,"seconds_remaining":null,"expiry_source":"none","logged_in":null,"proof":null,"verified":false,"browser_launched":false,"exit_code":0}
```

- `version` tracks the `version` field in `package.json`.
- `status` is one of `reused`, `refreshed`, `logged-in`, `refused`.
- `expiry_source` is one of `cookie`, `token`, `both`, `none`.
- `proof` is `assertion`, `not-proven-dead`, or `null`.
- `reason` is `null` when things went well, else a short reason code.

## Design notes

- Jars live in `~/.authstate/`, outside any repository.
- A jar file is named `<app>--<account>.json`, plus `--<namespace>` when set.
- Parallel callers collapse into one login through a lock folder beside the jar.
- An entry with no password refuses instead of guessing, and points at `authstate login --headed`.
- Freshness comes from cookie and token expiry maths, so the common case opens no browser.

## Security

- Your credentials file and your jars are local files. Never commit them.
- A jar holds live cookies and tokens. Treat it like a password.
- The bundled `.gitignore` already blocks credential and state files.
- If a jar or a credentials file ever leaks, change the password and sign the account out everywhere.

## Tests

```bash
bun test
```

## License

MIT. See `LICENSE`.
