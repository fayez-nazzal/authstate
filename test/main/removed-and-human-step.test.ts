import { expect, test } from "bun:test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = join(import.meta.dir, "..", "..", "src", "cli.ts");
const exampleFixture = join(import.meta.dir, "..", "fixtures", "example-app", ".testing-credentials.example.yaml");

test("--out exits 2 naming the removed flag", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", cli, "path", "--credentials", exampleFixture, "--out", "/tmp/wherever.json"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  expect(proc.exitCode).toBe(2);
  expect(stderr).toContain("--out");
});

test("--headed on ensure exits 2, it only belongs to login", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", cli, "ensure", "--credentials", exampleFixture, "--headed"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  expect(proc.exitCode).toBe(2);
  expect(stderr).toContain("--headed");
});

test("ensure on an entry with no password exits 6 and names login --headed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "authstate-human-"));
  const path = join(dir, ".testing-credentials.example.yaml");
  writeFileSync(
    path,
    `app: sso-app
default: sso-user
credentials:
  sso-user:
    email: person@example.com
    password: ""
    app_url: https://example.test/app
    signed_in_when:
      url_matches: "https://example.test/app/**"
`,
  );
  const proc = Bun.spawn({
    cmd: ["bun", "run", cli, "ensure", "--credentials", path],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  expect(proc.exitCode).toBe(6);
  expect(stderr).toContain("authstate login --headed");
});
