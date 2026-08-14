export type ExpirySource = "cookie" | "token" | "both" | "none";

export type FreshnessVerdict = {
  verdict: "proven-dead" | "not-proven-dead";
  expiresAtMs: number | null;
  source: ExpirySource;
};

const combineSource = (cookieMs: number | null, tokenMs: number | null): ExpirySource => {
  let source: ExpirySource;
  if (cookieMs !== null && tokenMs !== null) {
    source = "both";
  } else if (cookieMs !== null) {
    source = "cookie";
  } else if (tokenMs !== null) {
    source = "token";
  } else {
    source = "none";
  }
  return source;
};

export const decideFreshness = (cookieMs: number | null, tokenMs: number | null, nowMs: number): FreshnessVerdict => {
  const source = combineSource(cookieMs, tokenMs);
  let expiresAtMs: number | null = null;
  if (cookieMs !== null && tokenMs !== null) {
    expiresAtMs = Math.min(cookieMs, tokenMs);
  } else if (cookieMs !== null) {
    expiresAtMs = cookieMs;
  } else if (tokenMs !== null) {
    expiresAtMs = tokenMs;
  }
  let verdict: FreshnessVerdict["verdict"];
  if (expiresAtMs !== null && expiresAtMs <= nowMs) {
    verdict = "proven-dead";
  } else {
    verdict = "not-proven-dead";
  }
  return { verdict, expiresAtMs, source };
};
