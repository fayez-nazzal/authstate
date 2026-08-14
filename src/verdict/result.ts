import type { ExitCode, ReasonCode } from "@verdict/exit-code";

export type ExpirySource = "cookie" | "token" | "both" | "none";

export type ResultStatus = "reused" | "refreshed" | "logged-in" | "refused";

export type Result = {
  tool: "authstate";
  version: string;
  command: string;
  ok: boolean;
  status: ResultStatus;
  reason: ReasonCode | null;
  app: string;
  account: string;
  namespace: string | null;
  path: string | null;
  expires_at: string | null;
  seconds_remaining: number | null;
  expiry_source: ExpirySource;
  logged_in: boolean | null;
  proof: "assertion" | "not-proven-dead" | null;
  verified: boolean;
  browser_launched: boolean;
  exit_code: ExitCode;
};

export const writeResultLine = (result: Result): void => {
  console.log(JSON.stringify(result));
};
