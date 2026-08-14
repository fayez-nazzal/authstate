import { expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parseSignedInWhen } from "@signin-proof/assertion";

const cli = join(import.meta.dir, "..", "..", "src", "cli.ts");
const fixture = join(import.meta.dir, "..", "fixtures", "no-assertion-app", ".testing-credentials.example.yaml");
const jarPath = join(homedir(), ".authstate", "no-assertion-app--basic-user.json");

test("missing signed_in_when is a loud named failure", () => {
  const result = parseSignedInWhen(undefined, "basic-user");
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain("basic-user");
  }
});

test("an entry with no assertion exits 3, names the entry, and writes no jar", async () => {
  rmSync(jarPath, { force: true });
  const proc = Bun.spawn({
    cmd: ["bun", "run", cli, "ensure", "--credentials", fixture],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  expect(proc.exitCode).toBe(3);
  expect(stderr).toContain("basic-user");
  expect(existsSync(jarPath)).toBe(false);
});
