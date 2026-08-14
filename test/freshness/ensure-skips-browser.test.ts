import { expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const cli = join(import.meta.dir, "..", "..", "src", "main.ts");
const fixture = join(import.meta.dir, "..", "fixtures", "example-app", ".testing-credentials.example.yaml");
const jarPath = join(homedir(), ".authstate", "example-app--basic-user.json");

test("ensure on a fresh jar exits fast without launching a browser", async () => {
  mkdirSync(join(homedir(), ".authstate"), { recursive: true });
  const oneHourFromNow = Math.floor(Date.now() / 1000) + 3600;
  writeFileSync(
    jarPath,
    JSON.stringify({
      cookies: [{ name: "session", value: "x", expires: oneHourFromNow }],
      origins: [],
    }),
  );

  const started = Date.now();
  const proc = Bun.spawn({
    cmd: ["bun", "run", cli, "ensure", "--credentials", fixture, "--timeout", "100"],
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
  const elapsedMs = Date.now() - started;

  rmSync(jarPath, { force: true });

  expect(proc.exitCode).toBe(0);
  expect(elapsedMs).toBeLessThan(5000);
});
