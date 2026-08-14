import { expect, test } from "bun:test";
import { normalizeAppKey, resolveAppKey } from "@account/app-key";

test("normalizeAppKey strips a worktree suffix", () => {
  expect(normalizeAppKey("example-app.branch-a")).toBe("example-app");
});

test("resolveAppKey prefers the explicit app name", () => {
  const file = { app: "example-app", credentials: {} };
  expect(resolveAppKey(file, "/home/user/example-app.branch-a/.testing-credentials.yaml")).toBe("example-app");
});
