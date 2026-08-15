import type { CredentialsEntry } from "@account/app-key";

export type LoginStep =
  | { kind: "goto"; url: string }
  | { kind: "fill-email"; value: string; selector?: string }
  | { kind: "fill-password"; value: string; selector?: string }
  | { kind: "click-submit"; selector?: string };

export const planLogin = (entry: CredentialsEntry): LoginStep[] => [
  { kind: "goto", url: entry.app_url },
  { kind: "fill-email", value: entry.email, selector: entry.fields?.email },
  { kind: "fill-password", value: entry.password, selector: entry.fields?.password },
  { kind: "click-submit", selector: entry.fields?.submit },
];
