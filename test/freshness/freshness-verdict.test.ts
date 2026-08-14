import { expect, test } from "bun:test";
import { decideFreshness } from "@freshness/freshness-verdict";

const now = 1_000_000_000_000;

test("expired 1 second ago is proven-dead", () => {
  const verdict = decideFreshness(now - 1000, null, now);
  expect(verdict.verdict).toBe("proven-dead");
  expect(verdict.source).toBe("cookie");
});

test("expires in 1 second is not-proven-dead", () => {
  const verdict = decideFreshness(now + 1000, null, now);
  expect(verdict.verdict).toBe("not-proven-dead");
});

test("no cookie expiry and no token expiry is not-proven-dead, source none", () => {
  const verdict = decideFreshness(null, null, now);
  expect(verdict.verdict).toBe("not-proven-dead");
  expect(verdict.source).toBe("none");
});

test("token expiry alone is source token", () => {
  const verdict = decideFreshness(null, now - 1000, now);
  expect(verdict.verdict).toBe("proven-dead");
  expect(verdict.source).toBe("token");
});

test("both present takes the minimum and reports source both", () => {
  const verdict = decideFreshness(now + 5000, now + 1000, now);
  expect(verdict.expiresAtMs).toBe(now + 1000);
  expect(verdict.source).toBe("both");
  expect(verdict.verdict).toBe("not-proven-dead");
});

test("the verdict is never proven-alive, even far from any expiry", () => {
  const verdict = decideFreshness(now + 999999999, null, now);
  expect(verdict.verdict).toBe("not-proven-dead");
});
