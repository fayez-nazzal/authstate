# Contributing

Thanks for helping improve `authstate`.

## Setup

```sh
bun install
bun link
```

There is no build step. The `authstate` command runs `src/main.ts` straight from source.

## Tests

```sh
bun test
```

Tests do not need a browser. Keep it that way.

## Code style

- No code comments. Names carry the intent.
- One return at the end. No early return and no guard clause.
- One line per declaration, assignment, argument and call.
- `if` statements over ternaries.
- Explicit braces and explicit parentheses always.
- Plain checks over clever operators.

## Proposing a change

- Open an issue first for anything beyond a small fix.
- Keep the change scoped to the thing you describe.
- Add or update a test for every behaviour you change.
- Run `bun test` and make sure it passes.
- Update `README.md` and `AGENTS.md` when the behaviour a user sees changes.
- Open a pull request and fill in the template.
