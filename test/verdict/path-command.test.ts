import { expect, test } from "bun:test";
import { join } from "node:path";

const fixture = join(import.meta.dir, "..", "fixtures", "example-app", ".testing-credentials.example.yaml");

test("authstate path writes exactly one parseable stdout line and nothing else", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", join(import.meta.dir, "..", "..", "src", "cli.ts"), "path", "--credentials", fixture],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  const lines = stdout.trimEnd().split("\n");
  expect(lines.length).toBe(1);
  const parsed = JSON.parse(lines[0] as string);
  expect(parsed.tool).toBe("authstate");
  expect(parsed.command).toBe("path");
  expect(parsed.exit_code).toBe(0);
  expect(proc.exitCode).toBe(0);
});
