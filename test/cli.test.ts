import { expect, test } from "bun:test";
import { homedir } from "node:os";
import { canonicalJarPath, jarFileName, normalizeAppKey, resolveAppKey } from "../src/cli.ts";

test("normalizeAppKey strips a worktree suffix", () => {
  expect(normalizeAppKey("example-app.branch-a")).toBe("example-app");
});

test("normalizeAppKey lowercases and replaces unsafe characters", () => {
  expect(normalizeAppKey("My App_Name")).toBe("my-app-name");
});

test("normalizeAppKey falls back when nothing usable is left", () => {
  expect(normalizeAppKey("///")).toBe("app");
});

test("jarFileName keeps one jar per account", () => {
  expect(jarFileName("example-app", "basic-user")).toBe("example-app--basic-user.json");
  expect(jarFileName("example-app", "premium-user")).toBe("example-app--premium-user.json");
});

test("jarFileName adds a namespace for a separate session on one account", () => {
  expect(jarFileName("example-app", "basic-user", "slot2")).toBe("example-app--basic-user--slot2.json");
});

test("two accounts never share a jar", () => {
  const free = jarFileName("example-app", "basic-user");
  const essential = jarFileName("example-app", "premium-user");
  expect(free).not.toBe(essential);
});

test("every worktree of one repo resolves to the same jar", () => {
  const a = jarFileName("example-app.branch-a", "basic-user");
  const b = jarFileName("example-app.branch-b", "basic-user");
  expect(a).toBe(b);
});

test("canonicalJarPath lives under the authstate home", () => {
  expect(canonicalJarPath("example-app", "basic-user")).toBe(`${homedir()}/.authstate/example-app--basic-user.json`);
});

test("resolveAppKey prefers the explicit app name", () => {
  const file = { app: "example-app", credentials: {} };
  expect(resolveAppKey(file, "/home/user/example-app.branch-a/.testing-credentials.yaml")).toBe("example-app");
});

test("resolveAppKey falls back to the containing directory", () => {
  const file = { credentials: {} };
  expect(resolveAppKey(file, "/home/user/example-app.branch-a/.testing-credentials.yaml")).toBe("example-app");
});
