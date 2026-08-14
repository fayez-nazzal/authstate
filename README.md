# authstate

`authstate` logs in to a web app once and keeps the browser session on disk as a
Playwright `storageState` file. Other browser tools read that file instead of
handling passwords themselves.

Each account gets its own file, called a jar. Tools that share an account share
one login. Tools on different accounts never block each other.

## Requirements

- `bun` version 1.2 or newer.
- Google Chrome, or the Chromium that Playwright downloads.

## Install

```bash
bun install
bun link
```

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

- `app` names the jar. It defaults to the folder holding the file.
- `default` picks the entry used when no `--purpose` is passed.
- `purpose` is free text. `--purpose` matches an entry key or any part of it.

## Daily use

Make sure a valid jar exists and print its path.

```bash
authstate ensure --credentials .testing-credentials.yaml
```

Pick a different account.

```bash
authstate ensure --credentials .testing-credentials.yaml --purpose premium-user
```

Print the jar path without touching the network.

```bash
authstate path --credentials .testing-credentials.yaml
```

Log in again from scratch.

```bash
authstate ensure --credentials .testing-credentials.yaml --force
```

Watch the login in a real window, for an account that needs a code or a single
sign on step. This is the only command that opens a visible browser.

```bash
authstate login --credentials .testing-credentials.yaml --headed
```

Delete one account's jar and lock.

```bash
authstate revoke --credentials .testing-credentials.yaml --purpose premium-user
```

Delete every jar under a credentials file that the expiry maths already
proves dead.

```bash
authstate prune --credentials .testing-credentials.yaml
```

Feed the path straight into another tool.

```bash
STATE=$(authstate path --credentials .testing-credentials.yaml)
some-browser-tool --storage-state "$STATE"
```

## Options

- `--credentials <path>` the credentials file. Required.
- `--purpose <name>` which entry to use.
- `--namespace <name>` a second separate session on the same account.
- `--force` skip the freshness check and log in now.
- `--verify` open a browser to confirm a jar the expiry maths already calls
  fresh, instead of trusting it.
- `--headed` show the browser window. Valid only on `authstate login`.
- `--timeout <ms>` per step timeout. Default `20000`.

`--out` was removed. It let a live bearer credential land anywhere and broke
the one-jar-per-account rule; use `--namespace` for a second session on the
same account instead.

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

Each entry in the credentials file needs a `signed_in_when` block naming a
`url_matches` glob and/or a `selector` that only appears once actually signed
in. Without it `ensure` refuses with exit `3` and names the entry, instead of
guessing from page content.

## Security

- Your credentials file and your jars are local files. Never commit them.
- A jar holds live cookies and tokens. Treat it like a password.
- Jars live in `~/.authstate/` by default, outside any repository.
- The bundled `.gitignore` already blocks credential and state files.
- If a jar or a credentials file ever leaks, change the password and sign the
  account out everywhere.

## Tests

```bash
bun test
```

## License

MIT. See `LICENSE`.
