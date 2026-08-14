import { expect, test } from "bun:test";
import { resolveEntry } from "@account/entry-resolution";
import type { CredentialsFile } from "@account/app-key";

const file: CredentialsFile = {
  credentials: {
    "basic-user": { purpose: "basic", email: "a@example.com", password: "x", app_url: "https://a.test" },
    "basic-admin": { purpose: "basic admin", email: "b@example.com", password: "y", app_url: "https://b.test" },
  },
};

test("ambiguous substring names both candidates and does not pick one", () => {
  const result = resolveEntry(file, "basic");
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toContain("basic-user");
    expect(result.reason).toContain("basic-admin");
  }
});

test("exact key beats a substring hit", () => {
  const result = resolveEntry(file, "basic-user");
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.name).toBe("basic-user");
  }
});

test("unknown purpose is a named error", () => {
  const result = resolveEntry(file, "nope");
  expect(result.ok).toBe(false);
});
