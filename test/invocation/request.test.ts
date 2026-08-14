import { expect, test } from "bun:test";
import { parseRequest } from "@invocation/request";
import { ExitCode } from "@verdict/exit-code";

test("ensure with --headed is refused before anything launches", () => {
  const result = parseRequest(["ensure", "--credentials", "x.yaml", "--headed"]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.exitCode).toBe(ExitCode.usageError);
    expect(result.reason).toContain("--headed");
  }
});

test("login with --headed is accepted", () => {
  const result = parseRequest(["login", "--credentials", "x.yaml", "--headed"]);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.request.headed).toBe(true);
    expect(result.request.command).toBe("login");
  }
});

test("--out is a named usage error", () => {
  const result = parseRequest(["path", "--credentials", "x.yaml", "--out", "y.json"]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain("--out");
  }
});

test("an unknown command shows help and exits 2", () => {
  const result = parseRequest(["nonsense"]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.showHelp).toBe(true);
    expect(result.exitCode).toBe(ExitCode.usageError);
  }
});

test("missing --credentials is a usage error", () => {
  const result = parseRequest(["path"]);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.exitCode).toBe(ExitCode.usageError);
  }
});
