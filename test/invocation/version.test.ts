import { expect, test } from "bun:test";
import { VERSION } from "@invocation/help";
import packageJson from "../../package.json";

test("version matches package.json", () => {
  expect(VERSION).toBe(packageJson.version);
});
