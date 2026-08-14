import { expect, test } from "bun:test";
import { join } from "node:path";

const cli = join(import.meta.dir, "..", "..", "src", "cli.ts");
const ambiguousFixture = join(import.meta.dir, "..", "fixtures", "ambiguous-app", ".testing-credentials.example.yaml");

test("an ambiguous --purpose substring exits 4 and names both candidates, never picks one", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", cli, "path", "--credentials", ambiguousFixture, "--purpose", "basic"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;

  expect(proc.exitCode).toBe(4);
  expect(stderr).toContain("basic-user");
  expect(stderr).toContain("basic-admin");
});
