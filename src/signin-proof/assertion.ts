import type { SignInAssertion } from "@login/browser-session";

export type AssertionResult =
  | { ok: true; assertion: SignInAssertion }
  | { ok: false; reason: string };

export const parseSignedInWhen = (
  raw: { url_matches?: string; selector?: string } | undefined,
  entryName: string,
): AssertionResult => {
  let result: AssertionResult;
  if (!raw || (raw.url_matches == null && raw.selector == null)) {
    result = { ok: false, reason: `entry "${entryName}" has no signed_in_when assertion` };
  } else {
    result = { ok: true, assertion: { urlMatches: raw.url_matches, selector: raw.selector } };
  }
  return result;
};
