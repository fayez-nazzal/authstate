import type { CredentialsEntry } from "@account/app-key";

export type LoginStep =
  | { kind: "goto"; url: string }
  | { kind: "fill-email"; value: string }
  | { kind: "fill-password"; value: string }
  | { kind: "click-submit" };

export const planLogin = (entry: CredentialsEntry): LoginStep[] => [
  { kind: "goto", url: entry.app_url },
  { kind: "fill-email", value: entry.email },
  { kind: "fill-password", value: entry.password },
  { kind: "click-submit" },
];
