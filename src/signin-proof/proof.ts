import type { Observation } from "@login/browser-session";

export type ProofVerdict = "signed-in" | "signed-out" | "inconclusive";

export const proofFromObservation = (observation: Observation): ProofVerdict => {
  let verdict: ProofVerdict;
  if (observation.kind === "observed") {
    const selectorOk = observation.selectorMatched === null ? true : observation.selectorMatched;
    if (observation.urlMatched && selectorOk) {
      verdict = "signed-in";
    } else {
      verdict = "signed-out";
    }
  } else {
    verdict = "inconclusive";
  }
  return verdict;
};
