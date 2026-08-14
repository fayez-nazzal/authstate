import { expect, test } from "bun:test";
import { proofFromObservation } from "@signin-proof/proof";
import type { Observation } from "@login/browser-session";

const cases: Array<{ observation: Observation; expected: "signed-in" | "signed-out" | "inconclusive" }> = [
  { observation: { kind: "observed", urlMatched: true, selectorMatched: true }, expected: "signed-in" },
  { observation: { kind: "observed", urlMatched: true, selectorMatched: null }, expected: "signed-in" },
  { observation: { kind: "observed", urlMatched: false, selectorMatched: true }, expected: "signed-out" },
  { observation: { kind: "observed", urlMatched: true, selectorMatched: false }, expected: "signed-out" },
  { observation: { kind: "timed-out", waitedMs: 20000 }, expected: "inconclusive" },
  { observation: { kind: "navigation-failed", detail: "dns" }, expected: "inconclusive" },
  { observation: { kind: "browser-unavailable", detail: "no chrome" }, expected: "inconclusive" },
];

for (const { observation, expected } of cases) {
  test(`proofFromObservation(${observation.kind}) is ${expected}`, () => {
    expect(proofFromObservation(observation)).toBe(expected);
  });
}

test("only observed with a matched assertion ever yields signed-in", () => {
  for (const { observation, expected } of cases) {
    if (expected === "signed-in") {
      expect(observation.kind).toBe("observed");
    }
  }
});
