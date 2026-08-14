import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCredentialsFile } from "@account/credentials-file";

const writeYaml = (contents: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "authstate-test-"));
  const path = join(dir, ".testing-credentials.yaml");
  writeFileSync(path, contents);
  return path;
};

test("credentials is not a map returns a named ok:false result, not a thrown TypeError", () => {
  const path = writeYaml(`app: example-app\ncredentials: not a map\n`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain(path);
  }
});

test("malformed YAML returns a named ok:false result", () => {
  const path = writeYaml(`app: [unterminated\n`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain(path);
  }
});

test("valid file parses ok", () => {
  const path = writeYaml(`
app: example-app
default: basic-user
credentials:
  basic-user:
    email: a@example.com
    password: secret
    app_url: https://example.test
`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(true);
});
