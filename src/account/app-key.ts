import { basename, dirname } from "node:path";
import type { FieldSelectors } from "@login/field-locators";

export type CredentialsEntry = {
  purpose?: string;
  email: string;
  password: string;
  app_url: string;
  fields?: FieldSelectors;
  signed_in_when?: {
    url_matches?: string;
    selector?: string;
  };
};

export type CredentialsFile = {
  app?: string;
  default?: string;
  credentials: Record<string, CredentialsEntry>;
};

export function normalizeAppKey(raw: string): string {
  let key = raw.trim().toLowerCase();
  const dot = key.indexOf(".");
  if (dot > 0) {
    key = key.slice(0, dot);
  }
  key = key.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (key === "") {
    key = "app";
  }
  return key;
}

export const resolveAppKey = (file: CredentialsFile, credentialsPath: string): string => {
  let raw = file.app;
  if (raw == null || raw === "") {
    raw = basename(dirname(credentialsPath));
  }
  return normalizeAppKey(raw);
};
