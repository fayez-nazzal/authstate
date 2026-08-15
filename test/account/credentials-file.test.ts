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

test("an entry with no fields block still parses ok", () => {
  const path = writeYaml(`
credentials:
  basic-user:
    email: a@example.com
    password: secret
    app_url: https://example.test
`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(true);
});

test("an entry with string field selectors parses ok", () => {
  const path = writeYaml(`
credentials:
  mock-user:
    email: a@example.com
    password: secret
    app_url: https://example.test
    fields:
      email: "input[name='username']"
      password: "textarea[name='claims']"
      submit: "button[type='submit']"
`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(true);
});

test("a non string fields value names the entry and the key", () => {
  const path = writeYaml(`
credentials:
  mock-user:
    email: a@example.com
    password: secret
    app_url: https://example.test
    fields:
      email: 12
`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain("mock-user");
    expect(result.reason).toContain("email");
    expect(result.reason).toContain("fields");
  }
});

test("a fields block that is not a map names the entry", () => {
  const path = writeYaml(`
credentials:
  mock-user:
    email: a@example.com
    password: secret
    app_url: https://example.test
    fields: nope
`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain("mock-user");
    expect(result.reason).toContain("fields");
  }
});

test("an unknown key inside fields names the entry and the key", () => {
  const path = writeYaml(`
credentials:
  mock-user:
    email: a@example.com
    password: secret
    app_url: https://example.test
    fields:
      captcha: "input[name='captcha']"
`);
  const result = parseCredentialsFile(path);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain("mock-user");
    expect(result.reason).toContain("captcha");
  }
});
