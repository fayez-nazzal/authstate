import { expect, test } from "bun:test";
import { homedir } from "node:os";
import { canonicalJarPath, jarFileName } from "@jar/jar-path";

test("jarFileName keeps one jar per account", () => {
  expect(jarFileName("example-app", "basic-user")).toBe("example-app--basic-user.json");
});

test("canonicalJarPath lives under the authstate home", () => {
  expect(canonicalJarPath("example-app", "basic-user")).toBe(`${homedir()}/.authstate/example-app--basic-user.json`);
});
