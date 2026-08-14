import { expect, test } from "bun:test";
import { earliestCookieExpiryMs } from "@freshness/cookie-expiry";

test("no expiring cookies returns null", () => {
  expect(earliestCookieExpiryMs([{ name: "session", expires: -1 }])).toBeNull();
});

test("returns the earliest of several expiring cookies", () => {
  const cookies = [
    { name: "a", expires: 2000 },
    { name: "b", expires: 1000 },
  ];
  expect(earliestCookieExpiryMs(cookies)).toBe(1000000);
});
