import { expect, test } from "bun:test";
import { planEnsure } from "@ensure/ensure-plan";

const noJar = { exists: false, freshness: "not-proven-dead" as const };
const freshJar = { exists: true, freshness: "not-proven-dead" as const };
const deadJar = { exists: true, freshness: "proven-dead" as const };

test("no assertion is always refuse, no matter the jar state", () => {
  const plan = planEnsure({ force: false, verify: false }, false, freshJar);
  expect(plan.kind).toBe("refuse");
});

test("no jar on disk is login", () => {
  const plan = planEnsure({ force: false, verify: false }, true, noJar);
  expect(plan.kind).toBe("login");
});

test("a proven-dead jar is login", () => {
  const plan = planEnsure({ force: false, verify: false }, true, deadJar);
  expect(plan.kind).toBe("login");
});

test("force is always login, even on a fresh jar", () => {
  const plan = planEnsure({ force: true, verify: false }, true, freshJar);
  expect(plan.kind).toBe("login");
});

test("a fresh jar with --verify is verify, not reuse", () => {
  const plan = planEnsure({ force: false, verify: true }, true, freshJar);
  expect(plan.kind).toBe("verify");
});

test("a fresh jar with no flags is reuse, no browser", () => {
  const plan = planEnsure({ force: false, verify: false }, true, freshJar);
  expect(plan.kind).toBe("reuse");
});
