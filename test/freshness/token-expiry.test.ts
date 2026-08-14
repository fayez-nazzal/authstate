import { expect, test } from "bun:test";
import { earliestTokenExpiryMs } from "@freshness/token-expiry";

const makeJwt = (exp: number): string => {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64");
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64");
  return `${header}.${payload}.`;
};

test("no JWT exp claim returns null", () => {
  expect(earliestTokenExpiryMs(["not-a-jwt"])).toBeNull();
});

test("decodes exp without checking any signature", () => {
  const token = makeJwt(1700000000);
  expect(earliestTokenExpiryMs([token])).toBe(1700000000000);
});
