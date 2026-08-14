export type EnsureRequest = {
  force: boolean;
  verify: boolean;
};

export type JarFacts = {
  exists: boolean;
  freshness: "proven-dead" | "not-proven-dead";
};

export type EnsurePlan =
  | { kind: "reuse" }
  | { kind: "verify" }
  | { kind: "login" }
  | { kind: "refuse"; reason: string };

export const planEnsure = (request: EnsureRequest, assertionPresent: boolean, jar: JarFacts): EnsurePlan => {
  let plan: EnsurePlan;
  if (!assertionPresent) {
    plan = { reason: "no signed_in_when assertion for this entry", kind: "refuse" };
  } else if (request.force || !jar.exists || jar.freshness === "proven-dead") {
    plan = { kind: "login" };
  } else if (request.verify) {
    plan = { kind: "verify" };
  } else {
    plan = { kind: "reuse" };
  }
  return plan;
};
