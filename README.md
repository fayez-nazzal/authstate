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
sign on step.

```bash
authstate ensure --credentials .testing-credentials.yaml --headed
```

Feed the path straight into another tool.

```bash
STATE=$(authstate ensure --credentials .testing-credentials.yaml)
some-browser-tool --storage-state "$STATE"
```

## Options

- `--credentials <path>` the credentials file. Required.
- `--purpose <name>` which entry to use.
- `--out <path>` write the jar somewhere other than `~/.authstate/`.
- `--namespace <name>` a second separate session on the same account.
- `--force` skip the validity check and log in now.
- `--headed` show the browser window.
- `--timeout <ms>` per step timeout. Default `20000`.

Exit codes are `0` for a valid jar, `1` for a failed login, `2` for bad usage.

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
